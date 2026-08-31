import type { Page } from "./types/page.js";
import type { MarkdownResult, RenderContext, TocEntry } from "./types/renderer.js";
export type { MarkdownResult, RenderContext, TocEntry };
/**
 * 渲染 Markdown → HTML + 目录
 */
export declare function renderMarkdown(rawContent: string, page: Page, ctx: RenderContext): Promise<MarkdownResult>;
/**
 * 默认 slug 生成（保留：兼容旧 API；标题 id 现由 rehype-slug/github-slugger 生成）
 */
export declare function defaultSlugify(input: string): string;
