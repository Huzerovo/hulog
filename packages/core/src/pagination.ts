// FIXME
// 这个应该注册成 helper
import type { Page } from "@hulog/core";

/**
 * 分页工具（design-doc §4 generate：虚拟页面分页）。
 * URL 规则：第 1 页 = base，第 N 页 = base + paginationDir + "/N/"（默认站点级 /page/N/）。
 */

export interface PaginationData {
  /** 分页基础路径（如 "/" 或 "/categories/foo/"） */
  base: string;
  /** 分页目录名（config.paginationDir，默认 "page"） */
  format: string;
  current: number;
  total: number;
  prev: number; // 0 = 无上一页
  prevLink: string;
  next: number; // 0 = 无下一页
  nextLink: string;
}

export interface PaginateOptions {
  base: string;
  perPage: number;
  layout: string;
  /** 页码 → 页面数据（posts 切片 + pagination） */
  makePage: (data: { posts: Page[]; pagination: PaginationData }) => Page;
  /** 分页目录名，默认 "page" */
  format?: string;
}

/** 计算分页 URL：第 1 页返回 base，其余 base + format + N + "/" */
export function pageUrl(base: string, format: string, n: number): string {
  if (n <= 1) return base;
  const b = base.endsWith("/") ? base : base + "/";
  return b + format.replace(/\/+$/, "") + "/" + n + "/";
}

/** 将文章切片生成分页虚拟页面 */
export function paginate(posts: Page[], opts: PaginateOptions): Page[] {
  const { base, perPage, layout, makePage, format = "page" } = opts;
  if (posts.length === 0) return [];
  const total = Math.ceil(posts.length / perPage);
  const pages: Page[] = [];
  for (let i = 0; i < total; i++) {
    const current = i + 1;
    const slice = posts.slice(i * perPage, (i + 1) * perPage);
    const pagination: PaginationData = {
      base,
      format,
      current,
      total,
      prev: current > 1 ? current - 1 : 0,
      prevLink: current > 1 ? pageUrl(base, format, current - 1) : "",
      next: current < total ? current + 1 : 0,
      nextLink: current < total ? pageUrl(base, format, current + 1) : "",
    };
    pages.push(makePage({ posts: slice, pagination }));
  }
  return pages;
}

/** 置顶排序：front-matter pin 为真的文章优先（其余保持原顺序） */
export function pinSort(posts: Page[]): Page[] {
  const pin = posts.filter((p) => p.data.pin);
  const others = posts.filter((p) => !p.data.pin);
  return [...pin, ...others];
}
