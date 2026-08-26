import type { Page } from "./page.js";

/**
 * 分页工具类型（pageUrl / paginate / pinSort 以 helper 形式注册，见 helpers.ts）
 */

/** 分页数据 */
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

/** paginate 选项 */
export interface PaginateOptions {
  base: string;
  perPage: number;
  layout: string;
  /** 页码 → 页面数据（posts 切片 + pagination） */
  makePage: (data: { posts: Page[]; pagination: PaginationData }) => Page;
  /** 分页目录名，默认 "page" */
  format?: string;
}
