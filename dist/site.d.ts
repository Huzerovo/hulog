import type { Asset } from "./types/asset.js";
import type { Page } from "./types/page.js";
import type { Site } from "./types/site.js";
import type { SiteConfig } from "./types/config.js";
import type { Collection } from "./types/collection.js";
/**
 * Site 实现
 */
export declare class SiteImpl implements Site {
    collections: Map<string, Collection>;
    private _assets;
    private _config;
    constructor(config: SiteConfig);
    get pages(): Page[];
    get posts(): Page[];
    get publishedPages(): Page[];
    get assets(): Asset[];
    get config(): SiteConfig;
    /** 由 build 阶段设置全部资源（专属 + 全局） */
    setAssets(assets: Asset[]): void;
    getAssets(dir: string): Asset[];
}
