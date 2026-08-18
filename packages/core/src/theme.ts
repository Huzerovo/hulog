import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build, type Plugin as EsbuildPlugin } from "esbuild";
import { h } from "preact";
import { render } from "preact-render-to-string";
import type { LayoutProps, Theme } from "./types/index.js";
import type { HelperRegistry } from "./runtime.js";

/**
 * 主题加载与渲染
 * Node 无法直接 require .ts/.tsx，核心用 esbuild 将主题入口 bundle 为 ESM 后 import。
 */

export interface LoadedTheme {
  theme: Theme;
  /** 主题目录绝对路径 */
  dir: string;
  /** 主题资源目录绝对路径（assetsDir 配置，可选） */
  assetsDir: string | null;
}

const RUNTIME_ABS = fileURLToPath(new URL("./runtime.js", import.meta.url));

// 从 core 自身解析 preact（指向 ESM 入口），保证主题位于任意目录时都能 bundle。
// 这些模块同时 external：与 core 进程共享同一实例（preact context 依赖单实例，
// 否则主题内 createContext/useContext 与 preact-render-to-string 不互通）。
const requireFromCore = createRequire(import.meta.url);
const PREACT_EXTERNALS: Record<string, string> = (() => {
  const preactDir = path.dirname(requireFromCore.resolve("preact/package.json"));
  const prtsDir = path.dirname(
    requireFromCore.resolve("preact-render-to-string/package.json"),
  );
  return {
    preact: path.join(preactDir, "dist/preact.mjs"),
    "preact/jsx-runtime": path.join(preactDir, "jsx-runtime/dist/jsxRuntime.mjs"),
    "preact/hooks": path.join(preactDir, "hooks/dist/hooks.mjs"),
    "preact-render-to-string": path.join(prtsDir, "dist/index.mjs"),
  };
})();

/** 定位主题目录：themes/<name> → node_modules/<name> → 直接路径 */
export function resolveThemeDir(themeName: string, projectRoot: string): string {
  if (path.isAbsolute(themeName)) {
    if (fs.existsSync(themeName)) return themeName;
    throw new Error(`主题路径不存在: ${themeName}`);
  }
  const local = path.join(projectRoot, "themes", themeName);
  if (fs.existsSync(local)) return local;
  // 从项目根解析 node_modules（可能被 pnpm hoist 到上级）
  let dir = path.join(projectRoot, "node_modules", themeName);
  if (fs.existsSync(dir)) return dir;
  let up = path.dirname(projectRoot);
  while (up !== path.dirname(up)) {
    const candidate = path.join(up, "node_modules", themeName);
    if (fs.existsSync(candidate)) return candidate;
    up = path.dirname(up);
  }
  throw new Error(`未找到主题 "${themeName}"（已尝试 themes/${themeName} 与 node_modules）`);
}

/**
 * esbuild 虚拟模块插件：让主题代码可 `import { helper } from "hulog:helpers"`。
 * 导出列表在 bundle 时从本次构建的 helper 注册表生成。
 */
function helpersVirtualPlugin(registry: HelperRegistry): EsbuildPlugin {
  return {
    name: "hulog-virtual-helpers",
    setup(build) {
      build.onResolve({ filter: /^hulog:helpers$/ }, () => ({
        path: "hulog:helpers",
        namespace: "hulog",
      }));
      build.onLoad({ filter: /.*/, namespace: "hulog" }, () => {
        const names = Object.keys(registry.getHelpers());
        const exports = names
          .map(
            (n) =>
              `export const ${n} = (...args) => __h().${n}(...args);`,
          )
          .join("\n");
        return {
          contents: `import { __getHelpers as __h } from ${JSON.stringify("hulog:runtime")};\n${exports}`,
          loader: "js",
        };
      });
      build.onResolve({ filter: /^hulog:runtime$/ }, () => ({
        path: RUNTIME_ABS,
        // external：不打包，运行时从 core 加载同一 runtime 实例（共享 helpers 注册表）
        external: true,
      }));
    },
  };
}

/** bundle 并加载主题，返回主题模块 */
export async function loadTheme(
  themeName: string,
  projectRoot: string,
  registry: HelperRegistry,
): Promise<LoadedTheme> {
  const dir = resolveThemeDir(themeName, projectRoot);
  const entry = path.join(dir, "index.ts");
  if (!fs.existsSync(entry)) {
    throw new Error(`主题缺少入口文件 index.ts: ${dir}`);
  }

  const cacheDir = path.join(projectRoot, "node_modules", ".cache", "hulog");
  fs.mkdirSync(cacheDir, { recursive: true });
  const hash = crypto
    .createHash("md5")
    .update(dir)
    .digest("hex")
    .slice(0, 10);
  const outfile = path.join(cacheDir, `theme-${hash}.mjs`);

  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    jsx: "automatic",
    jsxImportSource: "preact",
    loader: {
      ".css": "text",
      ".svg": "text",
      ".png": "dataurl",
      ".jpg": "dataurl",
      ".jpeg": "dataurl",
      ".gif": "dataurl",
      ".webp": "dataurl",
      ".woff": "file",
      ".woff2": "file",
      ".ttf": "file",
    },
    plugins: [helpersVirtualPlugin(registry)],
    alias: PREACT_EXTERNALS,
    // runtime 与 preact 系列必须 external：与核心进程共享同一实例
    // （runtime 共享 helpers 注册表；preact 共享 context 单实例）
    external: [
      "hulog:runtime",
      RUNTIME_ABS,
      ...Object.values(PREACT_EXTERNALS),
    ],
    logLevel: "silent",
  });

  // 带版本 query 绕过 ESM 缓存（dev 热重载）
  const mod = await import(`${outfile}?t=${Date.now()}`);
  const theme = (mod.default ?? mod) as Theme;
  if (!theme || typeof theme.name !== "string" || !theme.layouts) {
    throw new Error(`主题入口未导出合法的 Theme 对象（需含 name 与 layouts）: ${dir}`);
  }

  let assetsDir: string | null = null;
  if (theme.assetsDir) {
    const abs = path.join(dir, theme.assetsDir);
    if (fs.existsSync(abs)) assetsDir = abs;
  }

  return { theme, dir, assetsDir };
}

/**
 * 渲染单页：选择布局（精确 → default → page → 报错），preact-render-to-string 输出 HTML。
 */
export function renderPage(
  loaded: LoadedTheme,
  props: LayoutProps,
): string {
  const { layouts } = loaded.theme;
  const layout =
    layouts[props.page.layout] ?? layouts.default ?? layouts.page;
  if (!layout) {
    throw new Error(
      `[${props.page.id}] 布局 "${props.page.layout}" 不存在，且主题无 default/page 布局回退`,
    );
  }
  return render(h(layout as any, props));
}

/** 读取主题 globalStyles 文件内容（无则 undefined） */
export function readThemeStyles(loaded: LoadedTheme): string | undefined {
  const gs = loaded.theme.globalStyles;
  if (!gs) return undefined;
  const abs = path.join(loaded.dir, gs);
  if (!fs.existsSync(abs)) return undefined;
  return fs.readFileSync(abs, "utf8");
}

/**
 * 计算主题资源输出前缀：
 * merge → /assets；namespace → /assets/<theme-name>
 */
export function themeAssetsPrefix(themeName: string, mode?: string): string {
  return mode === "namespace" ? `/assets/${themeName}` : "/assets";
}
