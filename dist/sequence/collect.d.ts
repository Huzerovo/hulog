import type { Collection } from "../types/collection.js";
import type { SiteConfig } from "../types/config.js";
import type { Page } from "../types/page.js";
/**
 * collect①（物理）：在 filter 之后运行，将物理页面按 collection 分组生成集合。
 * 只创建配置声明的集合（物理页必然属于配置集合），按配置声明顺序返回。
 */
export declare function seqCollect(config: SiteConfig, pages: Page[]): Collection[];
/**
 * collect②（虚拟）：在 generate 之后运行，将虚拟页面挂入 site.collections。
 * 虚拟页 collection 已存在（如某 generator 产出 "posts"）则并入，否则动态创建（如 core:virtual）。
 * 返回受影响（含新建）的集合。
 */
export declare function collectVirtual(collections: Map<string, Collection>, pages: Page[]): Collection[];
