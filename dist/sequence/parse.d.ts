import type { CollectionConfig } from "../types/collection.js";
import type { SiteConfig } from "../types/config.js";
import type { FileEntry } from "../types/sequence.js";
import { type Page } from "../types/page.js";
/**
 * 将单个 Markdown 文件解析为 Page
 */
export declare function parseFile(absPath: string, relPath: string, collectionConfig: CollectionConfig): Page;
/**
 * parse 阶段
 */
export declare function seqParse(siteConfig: SiteConfig, contentRoot: string, files: FileEntry[]): Page[];
