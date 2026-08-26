import path from "node:path";
import type { Page } from "./types/page.js";
import type { SiteConfig } from "./types/config.js";

/**
 * 路由与 URL 生成
 */

/** 日期前缀：2026-08-05-hello.md → { date: "2026-08-05", slug: "hello" } */
const DATE_PREFIX_RE = /^(\d{4})-(\d{2})-(\d{2})-(.+)$/;

export interface SlugInfo {
  /** 去掉扩展名、可选日期前缀后的 slug */
  slug: string;
  /** 文件名中提取的日期（YYYY-MM-DD），无则为 null */
  datePrefix: string | null;
}

/** 从文件名解析 slug 与日期前缀 */
export function parseSlugFromFilename(filename: string): SlugInfo {
  const base = filename.replace(/\.md$/i, "");
  const m = base.match(DATE_PREFIX_RE);
  if (m) {
    return { slug: m[4]!, datePrefix: `${m[1]}-${m[2]}-${m[3]}` };
  }
  return { slug: base, datePrefix: null };
}

/** 根据文件名推断 slug（index.md → 父目录名） */
export function slugFromFile(relPath: string): SlugInfo {
  const dir = path.dirname(relPath);
  const base = path.basename(relPath);
  if (base.toLowerCase() === "index.md") {
    return { slug: path.basename(dir), datePrefix: null };
  }
  return parseSlugFromFilename(base);
}

/**
 * 用变量替换路由模式中的占位符。
 * 支持 :slug :collection :year :month :day
 */
export function fillRoutePattern(
  pattern: string,
  vars: {
    slug: string;
    collection: string;
    date?: Date | null;
  },
): string {
  let out = pattern;
  out = out.replaceAll(":slug", encodeURIComponent(vars.slug));
  out = out.replaceAll(":collection", encodeURIComponent(vars.collection));
  const d = vars.date;
  out = out.replaceAll(":year", d ? String(d.getFullYear()) : "");
  out = out.replaceAll(
    ":month",
    d ? String(d.getMonth() + 1).padStart(2, "0") : "",
  );
  out = out.replaceAll(":day", d ? String(d.getDate()).padStart(2, "0") : "");
  // 归一化：确保以 / 开头和结尾
  if (!out.startsWith("/")) out = "/" + out;
  if (!out.endsWith("/")) out += "/";
  // 折叠重复斜杠（保留协议 // 除外，此处 URL 无协议）
  out = out.replace(/\/{2,}/g, "/");
  return out;
}

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
export function resolveUrl(input: RouteInput): string {
  if (input.permalink) {
    return fillRoutePattern(input.permalink, {
      slug: input.slug,
      collection: input.collection,
      date: input.date,
    });
  }
  if (input.routePattern) {
    return fillRoutePattern(input.routePattern, {
      slug: input.slug,
      collection: input.collection,
      date: input.date,
    });
  }
  // 默认：文件系统路径直接映射（相对 content/），index.md → 父目录
  const dir = path.dirname(input.relPath);
  const base = path.basename(input.relPath);
  if (base.toLowerCase() === "index.md") {
    return "/" + (dir === "." ? "" : dir + "/");
  }
  const { slug } = parseSlugFromFilename(base);
  return "/" + (dir === "." ? "" : dir + "/") + slug + "/";
}

/**
 * 站点根 URL（用于 sitemap / canonical 等，设计文档 url 字段）
 */
export function siteUrl(config: SiteConfig, url: string): string {
  const base = (config.url ?? "").replace(/\/+$/, "");
  return base ? base + url : url;
}
