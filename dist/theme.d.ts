import type { LayoutProps, Theme } from "./types/theme.js";
import type { PluginAPI } from "./plugins.js";
/**
 * 主题加载与渲染
 * Node 无法直接 require .ts/.tsx，核心用 esbuild 将主题入口 bundle 为 ESM 后 import。
 * 主题入口默认导出 `(api) => Theme`，与插件共享统一 api（可注册/使用 helper、generator 等）。
 */
export interface LoadedTheme {
    theme: Theme;
    /** 主题目录绝对路径 */
    dir: string;
    /** 主题资源目录绝对路径（assetsDir 配置，可选） */
    assetsDir: string | null;
}
/** 定位主题目录：themes/<name> → node_modules/<name> → 直接路径 */
export declare function resolveThemeDir(themeName: string, projectRoot: string): string;
/**
 * bundle 并加载主题，返回主题模块。
 * 主题入口默认导出 `(api) => Theme`（或直接导出 Theme 对象），api 与插件统一。
 */
export declare function loadTheme(themeName: string, projectRoot: string, api: PluginAPI): Promise<LoadedTheme>;
/**
 * 渲染单页：选择布局（精确 → default → page → 报错），preact-render-to-string 输出 HTML。
 */
export declare function renderPage(loaded: LoadedTheme, props: LayoutProps): string;
/** 读取主题 globalStyles 文件内容（无则 undefined） */
export declare function readThemeStyles(loaded: LoadedTheme): string | undefined;
/**
 * 计算主题资源输出前缀：
 * merge → /assets；namespace → /assets/<theme-name>
 */
export declare function themeAssetsPrefix(themeName: string, mode?: string): string;
