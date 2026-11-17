import type { Theme } from "../types/theme.js";
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
/** 定位主题目录：themes/<name> → node_modules/<name> → 直接路径 */
export declare function resolveThemeDir(themeName: string, projectRoot: string): string;
/**
 * bundle 并加载主题，返回主题模块。
 * 主题入口导出 Theme 对象（或 `(api) => Theme` 函数）。
 */
export declare function loadTheme(themeName: string, projectRoot: string): Promise<LoadedTheme>;
