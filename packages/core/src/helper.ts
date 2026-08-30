import {
  buildCategoryTree,
  categoryPathToUrl,
  categoryPathToString,
  parseCategories,
} from "./category.js";
import { pageUrl, paginate, pinSort } from "./pagination.js";
import type { HelperRegistry } from "./types/helper.js";
import type { Page, PageBase } from "./types/page.js";
import { VIRTUAL_PAGE_COLLECTION } from "./types/page.js";

/**
 * 核心内置 helper 注册（每次构建独立注册表）。
 * 插件与主题经 api.plugins.helper.get(...) 使用。
 */


export class HelperRegistryImpl implements HelperRegistry {
  private helpers = new Map<string, Function>();
  private assetsPrefix = "/assets";

  /** 注册模板辅助函数 */
  register(name: string, fn: Function): void {
    this.helpers.set(name, fn);
  }

  /** 获取辅助函数 */
  get(name: string): Function | undefined {
    return this.helpers.get(name);
  }

  /** 主题资源输出前缀（merge → /assets；namespace → /assets/<theme>） */
  setThemeAssetsPrefix(prefix: string): void {
    this.assetsPrefix = prefix;
  }

  get themeAssetsPrefix(): string {
    return this.assetsPrefix;
  }
}

export function registerCoreHelpers(registry: HelperRegistry): void {
  /** 分类工具 */
  registry.register("parseCategories", parseCategories);
  registry.register("categoryPathToString", categoryPathToString);
  registry.register("categoryPathToUrl", categoryPathToUrl);
  registry.register("buildCategoryTree", buildCategoryTree);

  /** 分页工具（generate 阶段虚拟页面分页） */
  registry.register("pageUrl", pageUrl);
  registry.register("paginate", paginate);
  registry.register("pinSort", pinSort);

  /** 站点 URL 辅助（部署子路径时后续可基于 config.url 扩展） */
  registry.register("urlFor", (url: string) => {
    if (typeof url !== "string") return url;
    if (!url.startsWith("/")) url = "/" + url;
    return url;
  });

  /** 日期格式化：YYYY-MM-DD / YYYY-MM-DD HH:mm / 年 月 日 */
  registry.register("date", (d: Date | string | undefined, format?: string) => {
    if (!d) return "";
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return "";
    if (format) {
      return format
        .replaceAll("YYYY", String(date.getFullYear()))
        .replaceAll("MM", String(date.getMonth() + 1).padStart(2, "0"))
        .replaceAll("DD", String(date.getDate()).padStart(2, "0"))
        .replaceAll("HH", String(date.getHours()).padStart(2, "0"))
        .replaceAll("mm", String(date.getMinutes()).padStart(2, "0"));
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });

  /** 站点全局资源 */
  registry.register("assetUrl", (p: string) => {
    const s = String(p).replace(/^\/+/, "");
    return "/assets/" + s;
  });

  /**
   * 主题资源：前缀随 assetsMode 变化。
   * merge → /assets/<path>；namespace → /assets/<theme-name>/<path>
   * 前缀由 build 阶段经 registry.setThemeAssetsPrefix 设置。
   */
  registry.register("themeAsset", (p: string) => {
    const s = String(p).replace(/^\/+/, "");
    return registry.themeAssetsPrefix + "/" + s;
  });

  /** 封面确定性选择：单封面直接返回；多封面基于 slug 哈希取模 */
  registry.register(
    "pickCover",
    (page: { cover?: string | string[]; slug?: string; }) => {
      if (!page.cover) return null;
      const list = Array.isArray(page.cover) ? page.cover : [page.cover];
      if (list.length === 0) return null;
      if (list.length === 1) return list[0];
      let hash = 0;
      const slug = page.slug ?? "";
      for (let i = 0; i < slug.length; i++) {
        hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
      }
      return list[hash % list.length]!;
    },
  );
  registry.register("virtualPage", (page: PageBase) => {
    return {
      ...page,
      collection: VIRTUAL_PAGE_COLLECTION,
      sourcePath: "",
      aliases: [],
      slug: "",
      rawContent: "",
      content: "",
      data: {},
      metadata: {},
    };
  });

  registry.register("sortPages", (pages: Page[], by: "title" | "date", order: "asc" | "desc") => {
    const d = order === "asc" ? 1 : -1;
    return pages.sort((a, b) => {
      switch (by) {
        case "title":
          return a.title.localeCompare(b.title) * d;
        case "date":
        default: {
          const da = a.date?.getTime() ?? 0;
          const db = b.date?.getTime() ?? 0;
          return (da - db) * d;
        }
      }

    });
  });
}
