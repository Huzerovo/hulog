import type { SiteConfig } from "./types/config.js";
export interface SlugInfo {
    /** 去掉扩展名、可选日期前缀后的 slug */
    slug: string;
    /** 文件名中提取的日期（YYYY-MM-DD），无则为 null */
    datePrefix: string | null;
}
/** 从文件名解析 slug 与日期前缀 */
export declare function parseSlugFromFilename(filename: string): SlugInfo;
/** 根据文件名推断 slug（index.md → 父目录名） */
export declare function slugFromFile(relPath: string): SlugInfo;
/**
 * 用变量替换路由模式中的占位符。
 * 支持 :slug :collection :year :month :day
 */
export declare function fillRoutePattern(pattern: string, vars: {
    slug: string;
    collection: string;
    date?: Date | null;
}): string;
export interface RouteInput {
    /** 相对 content/ 的源路径，如 "posts/hello.md" */
    relPath: string;
    /** 集合名 */
    collection: string;
    /** 集合 routePattern 或 permalink */
    routePattern?: string;
    /** front-matter permalink（最高优先级） */
    permalink?: string;
    /** 文件名解析出的 slug */
    slug: string;
    /** 日期（front-matter 或文件名前缀） */
    date?: Date | null;
}
/**
 * 生成页面 url：
 * permalink（front-matter）→ routePattern → 文件系统路径默认规则。
 */
export declare function resolveUrl(input: RouteInput): string;
/**
 * 站点根 URL（用于 sitemap / canonical 等，设计文档 url 字段）
 */
export declare function siteUrl(config: SiteConfig, url: string): string;
