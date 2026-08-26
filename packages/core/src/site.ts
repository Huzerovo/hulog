import type {
  Asset,
  Collection,
  CollectionConfig,
  Page,
  Site,
  SiteConfig,
} from "./types/index.js";

/**
 * Collection 实现
 */
export class CollectionImpl implements Collection {
  name: string;
  config: CollectionConfig;
  pages: Page[] = [];

  constructor(name: string, config: CollectionConfig, pages: Page[] = []) {
    this.name = name;
    this.config = config;
    this.pages = pages;
  }

  getPages(sorted = false): Page[] {
    if (!sorted) return this.pages;
    const { sortBy = "date", sortOrder = "desc" } = this.config;
    const dir = sortOrder === "asc" ? 1 : -1;
    return [...this.pages].sort((a, b) => {
      switch (sortBy) {
        case "title":
          return a.title.localeCompare(b.title) * dir;
        case "custom":
          return 0; // 自定义排序由插件通过 beforeFilter 处理
        case "date":
        default: {
          const da = a.date?.getTime() ?? 0;
          const db = b.date?.getTime() ?? 0;
          return (da - db) * dir;
        }
      }
    });
  }
}

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

  getCollection(name: string): Collection {
    const col = this.collections.get(name);
    if (!col) throw new Error(`集合不存在: ${name}`);
    return col;
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
