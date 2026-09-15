import type { LayoutProps, Theme } from "../types/theme.js";
/**
 * 渲染单页：选择布局（精确 → default → page → 报错），preact-render-to-string 输出 HTML。
 */
export declare function renderPage(theme: Theme, props: LayoutProps): string;
