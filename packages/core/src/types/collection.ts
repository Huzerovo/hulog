import type { Page } from "./page.js";
import type { ZodType } from "zod";

/**
 * CollectionConfig —— 集合配置
 */
export interface CollectionConfig {
  /** 集合名称 */
  name: string;

  /** 相对 content/ 的路径，如 "posts" */
  sourceDir: string;

  /** 默认路由，如 "/:collection/:slug/"；blog 等集合建议 "/post/:slug/" 以避免与部署子路径词重复 */
  routePattern?: string;

  /** 永久链接格式，优先级高于 routePattern */
  permalink?: string;

  /** 默认布局，例如 "post" */
  defaultLayout?: string;

  /** 排序规则 */
  sortBy?: "date" | "title" | "custom";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";

  /** front-matter 校验 schema */
  schema?: ZodType;
}

/**
 * Collection —— 内容集合
 */
export interface Collection {
  /** 集合名称 */
  name: string;

  /** 集合配置 */
  config: CollectionConfig;

  /** 该集合的全部页面 */
  pages: Page[];

  /** 按指定排序规则获取页面 */
  getPages(sorted?: boolean): Page[];
}
