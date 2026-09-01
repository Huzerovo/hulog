import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { h } from "preact";
import { render } from "preact-render-to-string";
// 从 core 自身解析 preact（指向 ESM 入口），保证主题位于任意目录时都能 bundle。
// 这些模块同时 external：与 core 进程共享同一实例（preact context 依赖单实例，
// 否则主题内 createContext/useContext 与 preact-render-to-string 不互通）。
const requireFromCore = createRequire(import.meta.url);
const PREACT_EXTERNALS = (() => {
    const preactDir = path.dirname(requireFromCore.resolve("preact/package.json"));
    const prtsDir = path.dirname(requireFromCore.resolve("preact-render-to-string/package.json"));
    return {
        preact: path.join(preactDir, "dist/preact.mjs"),
        "preact/jsx-runtime": path.join(preactDir, "jsx-runtime/dist/jsxRuntime.mjs"),
        "preact/hooks": path.join(preactDir, "hooks/dist/hooks.mjs"),
        "preact-render-to-string": path.join(prtsDir, "dist/index.mjs"),
    };
})();
/** 定位主题目录：themes/<name> → node_modules/<name> → 直接路径 */
export function resolveThemeDir(themeName, projectRoot) {
    if (path.isAbsolute(themeName)) {
        if (fs.existsSync(themeName))
            return themeName;
        throw new Error(`主题路径不存在: ${themeName}`);
    }
    const local = path.join(projectRoot, "themes", themeName);
    if (fs.existsSync(local))
        return local;
    // 从项目根解析 node_modules（可能被 pnpm hoist 到上级）
    let dir = path.join(projectRoot, "node_modules", themeName);
    if (fs.existsSync(dir))
        return dir;
    let up = path.dirname(projectRoot);
    while (up !== path.dirname(up)) {
        const candidate = path.join(up, "node_modules", themeName);
        if (fs.existsSync(candidate))
            return candidate;
        up = path.dirname(up);
    }
    throw new Error(`未找到主题 "${themeName}"（已尝试 themes/${themeName} 与 node_modules）`);
}
/**
 * bundle 并加载主题，返回主题模块。
 * 主题入口默认导出 `(api) => Theme`（或直接导出 Theme 对象），api 与插件统一。
 */
export async function loadTheme(themeName, projectRoot, api) {
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
        alias: PREACT_EXTERNALS,
        // preact 系列与 @hulog/core 必须 external：与核心进程共享同一实例
        // （preact 共享 context 单实例；core 供主题导入常量/工具）
        external: ["@hulog/core", ...Object.values(PREACT_EXTERNALS)],
        logLevel: "silent",
    });
    // 带版本 query 绕过 ESM 缓存（dev 热重载）
    const mod = await import(`${outfile}?t=${Date.now()}`);
    const candidate = (mod.default ?? mod);
    const theme = typeof candidate === "function"
        ? await candidate(api)
        : candidate;
    if (!theme || typeof theme.name !== "string" || !theme.layouts) {
        throw new Error(`主题入口未导出合法的 Theme 对象（需含 name 与 layouts）: ${dir}`);
    }
    let assetsDir = null;
    if (theme.assetsDir) {
        const abs = path.join(dir, theme.assetsDir);
        if (fs.existsSync(abs))
            assetsDir = abs;
    }
    return { theme, dir, assetsDir };
}
/**
 * 渲染单页：选择布局（精确 → default → page → 报错），preact-render-to-string 输出 HTML。
 */
export function renderPage(loaded, props) {
    const { layouts } = loaded.theme;
    const layout = layouts[props.page.layout] ?? layouts.default ?? layouts.page;
    if (!layout) {
        throw new Error(`[${props.page.id}] 布局 "${props.page.layout}" 不存在，且主题无 default/page 布局回退`);
    }
    return "<!DOCTYPE html>\n" + render(h(layout, props));
}
/** 读取主题 globalStyles 文件内容（无则 undefined） */
export function readThemeStyles(loaded) {
    const gs = loaded.theme.globalStyles;
    if (!gs)
        return undefined;
    const abs = path.join(loaded.dir, gs);
    if (!fs.existsSync(abs))
        return undefined;
    return fs.readFileSync(abs, "utf8");
}
/**
 * 计算主题资源输出前缀：
 * merge → /assets；namespace → /assets/<theme-name>
 */
export function themeAssetsPrefix(themeName, mode) {
    return mode === "namespace" ? `/assets/${themeName}` : "/assets";
}
//# sourceMappingURL=theme.js.map