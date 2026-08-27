import type { SiteConfig } from "./config.js";
import type { Page } from "./page.js";
import type { ResolveContext } from "../assets.js";

/**
 * 渲染器 —— 将 Markdown 渲染为 HTML + 目录。
 * render 阶段为单一职责（不可 hook、可被用户 renderer 覆盖）；before/afterRender 可 hook。
 */
/** 渲染器注册表：register 即覆盖当前渲染器（内置默认 renderer 被用户 renderer 替换） */
export interface RendererRegistry {
  register(name: string, render: Renderer): void;
  get(name: string): Renderer | undefined;
}


/** 目录条目 */
export interface TocEntry {
  level: number; // 1-3
  id: string;
  text: string;
}

/** 渲染结果 */
export interface MarkdownResult {
  html: string;
  toc: TocEntry[];
}

/** 渲染上下文 */
export interface RenderContext {
  config: SiteConfig;
  resolve: ResolveContext;
}

/** 渲染函数：raw Markdown → HTML + toc */
export type Renderer = (
  rawContent: string,
  page: Page,
  ctx: RenderContext,
) => MarkdownResult | Promise<MarkdownResult>;

