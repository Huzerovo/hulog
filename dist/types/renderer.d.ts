import type { SiteConfig } from "./config.js";
import type { Page } from "./page.js";
import type { Asset } from "./asset.js";
/**
 * 渲染器 —— 将 Markdown 渲染为 HTML + 目录。
 * render 阶段为单一职责（不可 hook、可被用户 renderer 覆盖）；before/afterRender 可 hook。
 */
/** 渲染器注册表：按 name 注册/取用（内置默认 renderer 为 "markdown"） */
export interface RendererRegistry {
    register(name: string, render: Renderer): void;
    get(name: string): Renderer | undefined;
}
/** 目录条目 */
export interface TocEntry {
    level: number;
    id: string;
    text: string;
}
/** 渲染结果 */
export interface MarkdownResult {
    html: string;
    toc: TocEntry[];
}
/**
 * 资源上下文：供 renderer 解析文章内资源引用。
 * 隐藏 assetsDir / 专属目录映射等内部细节，只暴露必要能力。
 */
export interface AssetRegistry {
    /** 全部资源（专属 + 全局） */
    list: Asset[];
    /** 解析资源引用为最终 URL；未命中返回 null */
    resolve(ref: string, page: Page): string | null;
}
/** 渲染上下文：站点配置 + 资源上下文 */
export interface RenderContext {
    config: SiteConfig;
    assets: AssetRegistry;
}
/** 渲染函数：raw Markdown → HTML + toc */
export type Renderer = (rawContent: string, page: Page, ctx: RenderContext) => MarkdownResult | Promise<MarkdownResult>;
