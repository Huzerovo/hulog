import type { Asset } from "./types/asset.js";
import type { Page } from "./types/page.js";
import type { Site } from "./types/site.js";
import type { SiteConfig } from "./types/config.js";
import type { Collection } from "./types/collection.js";

/**
 * Site 实现
 */
export class SiteImpl implements Site {
  collections: Map<string, Collection> = new Map();
  private _assets: Asset[] = [];
  private _config: SiteConfig | undefined = void 0;

  constructor(config: SiteConfig) {
    this._config = config;
  }

  get pages(): Page[] {
    return [...this.collections.values()].flatMap((c) => c.pages);
  }

  get publishedPages(): Page[] {
    return this.pages.filter((p) => !p.draft);
  }

  get assets(): Asset[] {
    return this._assets;
  }

  get config(): SiteConfig {
    return this._config!;
  }

  /** 由 build 阶段设置全部资源（专属 + 全局） */
  setAssets(assets: Asset[]): void {
    this._assets = assets;
  }

  getAssets(dir: string): Asset[] {
    return this._assets.filter((a) => a.sourcePath.startsWith(dir));
  }
}
