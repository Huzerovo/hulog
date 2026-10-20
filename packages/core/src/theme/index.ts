import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import type { Theme } from "../types/theme.js";
import { loadThemeConfig } from "../config.js";

export { renderPage } from "./render.js";

/**
 * 主题加载
 * Node 无法直接 require .ts/.tsx，核心用 esbuild 将主题入口 bundle 为 ESM 后 import。
 */

export interface LoadedTheme {
  theme: Theme;
  /** 主题目录绝对路径 */
  themePath: string;
}

/** 当前 @hulog/core 包根目录（src/theme 或 dist/theme 的上两级） */
const CORE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * 主题 bundle 将 `@hulog/core` 标为 external；为保证站点根未安装 core 时
 * （如单文件渲染指向普通目录）仍可解析，在主题缓存目录内提供指向当前 core 的链接。
 * 仅写入 `<root>/node_modules/.cache/hulog` 内部，不影响站点其它依赖。
 */
function ensureCoreResolvable(cacheDir: string): void {
  const linkDir = path.join(cacheDir, "node_modules", "@hulog");
  const linkPath = path.join(linkDir, "core");
  try {
    // 已指向当前 core（开发热重载/多次构建）则直接复用
    if (fs.realpathSync(linkPath) === fs.realpathSync(CORE_ROOT)) return;
  } catch {
    /* 不存在或断链，继续重建 */
  }
  try {
    fs.mkdirSync(linkDir, { recursive: true });
    try {
      fs.unlinkSync(linkPath);
    } catch {
      /* 不存在或为真实目录：忽略 */
    }
    fs.symlinkSync(CORE_ROOT, linkPath, "junction");
  } catch {
    /* 权限/平台不支持时忽略：站点根可解析 @hulog/core 时仍可正常工作 */
  }
}

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
 * bundle 并加载主题，返回主题模块。
 * 主题入口导出 Theme 对象（或 `(api) => Theme` 函数）。
 */
export async function loadTheme(
  themeName: string,
  projectRoot: string,
): Promise<LoadedTheme> {
  const themePath = resolveThemeDir(themeName, projectRoot);
  const entry = path.join(themePath, "index.ts");
  if (!fs.existsSync(entry)) {
    throw new Error(`主题缺少入口文件 index.ts: ${themePath}`);
  }

  const cacheDir = path.join(projectRoot, "node_modules", ".cache", "hulog");
  fs.mkdirSync(cacheDir, { recursive: true });
  ensureCoreResolvable(cacheDir);
  const hash = crypto
    .createHash("md5")
    .update(themePath)
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
    alias: PREACT_EXTERNALS,
    // preact 系列与 @hulog/core 必须 external：与核心进程共享同一实例
    // （preact 共享 context 单实例；core 供主题导入常量/工具）
    external: ["@hulog/core", ...Object.values(PREACT_EXTERNALS)],
    logLevel: "silent",
  });

  // 带版本 query 绕过 ESM 缓存（dev 热重载）
  const mod = await import(`${outfile}?t=${Date.now()}`);
  const theme = (mod.default ?? mod) as Theme;
  if (!theme || typeof theme.name !== "string" || !theme.layouts) {
    throw new Error(`主题入口未导出合法的 Theme 对象（需含 name 与 layouts）: ${themePath}`);
  }

  // 加载主题配置文件
  const themeConfig = await loadThemeConfig(projectRoot);
  theme.config = {
    ...(theme.config ?? {}),
    ...(themeConfig ?? {}),
  };

  return { theme, themePath };
}
