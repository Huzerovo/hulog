
import type { Collection, CollectionConfig } from "./types/collection.js";
import type { Page } from "./types/page.js";
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
        // TODO 考虑需不需要自定义排序的功能
        // case "custom":
        //   return 0; // 自定义排序由插件通过 beforeFilter 处理
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

