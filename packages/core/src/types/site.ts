import type { Collection } from "./collection.js";
import type { Page } from "./page.js";
import type { Asset } from "./asset.js";
import type { SiteConfig } from "./config.js";

/**
 * Site —— 全局站点对象（Pages 与 SiteConfig 的访问接口）
 * init 阶段创建，贯穿整个构建生命周期。
 */
export interface Site {
  /** 全部集合，按名称索引 */
  collections: Map<string, Collection>;

  /** 全部页面（所有集合的扁平数组） */
  get pages(): Page[];

  /** 获取全部文章（允许渲染草稿时也会包括草稿） */
  get posts(): Page[];

  /** 全部资源（专属 + 全局），供插件枚举 */
  get assets(): Asset[];

  /** 按源目录前缀查询资源，如 getAssets("content/photos/album1")（相册插件等场景） */
  getAssets(dir: string): Asset[];

  get config(): SiteConfig;
}
