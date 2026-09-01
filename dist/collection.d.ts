import type { Collection, CollectionConfig } from "./types/collection.js";
import type { Page } from "./types/page.js";
/**
 * Collection 实现
 */
export declare class CollectionImpl implements Collection {
    name: string;
    config: CollectionConfig;
    pages: Page[];
    constructor(name: string, config: CollectionConfig, pages?: Page[]);
    getPages(sorted?: boolean): Page[];
}
