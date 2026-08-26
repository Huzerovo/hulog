import type { Page } from "./types/page.js";
import type { PaginateOptions } from "./types/pagination.js";

/**
 * 分页工具（design-doc §4 generate：虚拟页面分页）。
 * pageUrl / paginate / pinSort 以核心 helper 形式注册（见 helpers.ts），
 * 插件与主题经 api.plugins.helper.get(...) 使用。
 */

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
    const pagination = {
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
