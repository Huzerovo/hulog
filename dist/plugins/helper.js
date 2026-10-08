import { buildCategoryTree, categoryPathToUrl, categoryPathToString, parseCategories, } from "../category.js";
import { pageUrl, paginate, pinSort } from "../pagination.js";
import { VIRTUAL_PAGE_COLLECTION } from "../types/page.js";
/**
 * 核心内置 helper 注册（每次构建独立注册表）。
 * 插件与主题经 api.helper.get(...) 使用。
 */
/** Markdown 链接文本转义（对 [ ] \ 加反斜杠） */
function escapeLinkText(text) {
    return text.replace(/[\\[\]]/g, "\\$&");
}
export class HelperRegistryImpl {
    helpers = new Map();
    _site;
    constructor(site) {
        this._site = site;
    }
    /** 注册模板辅助函数 */
    register(name, fn) {
        this.helpers.set(name, fn);
    }
    /** 获取辅助函数 */
    get(name) {
        return this.helpers.get(name);
    }
    get site() {
        return this._site;
    }
}
export function registerCoreHelpers(registry) {
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
    registry.register("urlFor", (url) => {
        if (typeof url !== "string")
            return url;
        if (!url.startsWith("/"))
            url = "/" + url;
        return url;
    });
    /** 日期格式化：YYYY-MM-DD / YYYY-MM-DD HH:mm / 年 月 日 */
    registry.register("date", (d, format) => {
        if (!d)
            return "";
        const date = d instanceof Date ? d : new Date(d);
        if (isNaN(date.getTime()))
            return "";
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
    /** 站点全局资源（前缀随 config.assetsDir，默认 /assets） */
    registry.register("assetUrl", (p) => {
        const s = String(p).replace(/^\/+/, "");
        const base = registry.site.config.assetsDir ?? "assets";
        return `/${base}/` + s;
    });
    registry.register("archivesUrl", () => {
    });
    /**
     * 主题资源：前缀随 themeAssetsMode 变化（merge → /assets，namespace → /assets/<theme>）。
     * 依 site.config.themeAssetsMode / site.config.theme 决定（helper 绑定 site）。
     */
    registry.register("themeAsset", (p) => {
        const s = String(p).replace(/^\/+/, "");
        const themeName = registry.site.config.theme;
        const mode = registry.site.config.themeAssetsMode;
        return mode === "namespace" ? `/assets/${themeName}/${s}` : `/assets/${s}`;
    });
    registry.register("virtualPage", (page) => {
        return {
            ...page,
            collection: VIRTUAL_PAGE_COLLECTION,
            sourcePath: "",
            slug: "",
            rawContent: "",
            content: "",
            data: {},
            metadata: {},
        };
    });
    registry.register("sortPages", (pages, by, order) => {
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
    /**
     * 生成文章 Markdown 链接：[标题](url)。
     * - collection：限定查找集合（缺省 posts 优先、非虚拟页面回退）；
     * 未命中返回 ""（不抛错，由调用方决定提示）。
     * 可直接在主题中使用，也可在 markdown 中写 {{linkToPost("标题", "集合")}}（beforeRender 展开）。
     */
    registry.register("linkToPost", (title, collection) => {
        const key = String(title ?? "").trim();
        if (!key)
            return "";
        const site = registry.site;
        let hit;
        if (collection) {
            hit = site.collections
                .get(collection)
                ?.getPages()
                .find((p) => p.title === key);
        }
        else {
            hit =
                site.posts.find((p) => p.title === key) ??
                    site.pages.find((p) => p.collection !== VIRTUAL_PAGE_COLLECTION && p.title === key);
        }
        if (!hit)
            return "";
        return `[${escapeLinkText(key)}](${hit.url})`;
    });
    /**
     * 参与分类 / 标签统计的页面：全部非虚拟集合的页面（文章），按日期降序。
     * 分类页、标签云、分类树的统一数据源（虚拟列表页自身无 tags/categories）。
     */
    registry.register("taxonomyPages", () => {
        return [...registry.site.pages]
            .filter((p) => p.collection !== VIRTUAL_PAGE_COLLECTION)
            .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
    });
}
//# sourceMappingURL=helper.js.map