import { __registerHelper } from "./runtime.js";
import {
  buildCategoryTree,
  categoryPathToUrl,
  categoryPathToString,
  parseCategories,
} from "./category.js";

/**
 * 核心内置 helper 注册
 * 主题通过 `import { assetUrl } from "hulog:helpers"` 使用。
 */

/** 分类工具（主题经 hulog:helpers 使用） */
__registerHelper("parseCategories", parseCategories);
__registerHelper("categoryPathToString", categoryPathToString);
__registerHelper("categoryPathToUrl", categoryPathToUrl);
__registerHelper("buildCategoryTree", buildCategoryTree);

/** 站点 URL 辅助（部署子路径时后续可基于 config.url 扩展） */
__registerHelper("urlFor", (url: string) => {
  if (typeof url !== "string") return url;
  if (!url.startsWith("/")) url = "/" + url;
  return url;
});

/** 日期格式化：YYYY-MM-DD / YYYY-MM-DD HH:mm / 年 月 日 */
__registerHelper("date", (d: Date | string | undefined, format?: string) => {
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
__registerHelper("assetUrl", (p: string) => {
  const s = String(p).replace(/^\/+/, "");
  return "/assets/" + s;
});

/**
 * 主题资源：前缀随 assetsMode 变化。
 * merge → /assets/<path>；namespace → /assets/<theme-name>/<path>
 */
let themeAssetsPrefix = "/assets";
export function __setThemeAssetsPrefix(prefix: string) {
  themeAssetsPrefix = prefix;
}
__registerHelper("themeAsset", (p: string) => {
  const s = String(p).replace(/^\/+/, "");
  return themeAssetsPrefix + "/" + s;
});

/** 封面确定性选择：单封面直接返回；多封面基于 slug 哈希取模 */
__registerHelper("pickCover", (page: { cover?: string | string[]; slug?: string }) => {
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
});
