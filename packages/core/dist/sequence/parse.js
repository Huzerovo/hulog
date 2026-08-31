import fs from "node:fs";
import matter from "gray-matter";
import path from "node:path";
import { RESERVED_KEYS } from "../types/page.js";
import { parseCategories } from "../category.js";
import { parseSlugFromFilename, resolveUrl } from "../route.js";
import { toPosixPath } from "../path.js";
/** front-matter 中的日期值 → Date（支持 Date、字符串、时间戳） */
function toDate(value) {
    if (value instanceof Date)
        return isNaN(value.getTime()) ? undefined : value;
    if (typeof value === "number") {
        const d = new Date(value);
        return isNaN(d.getTime()) ? undefined : d;
    }
    if (typeof value === "string") {
        const d = new Date(value);
        return isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
}
/** 字符串数组归一化（front-matter tags/categories 可能是字符串或数组） */
function toStringArray(value) {
    if (Array.isArray(value))
        return value.map(String);
    if (typeof value === "string")
        return value ? [value] : [];
    return [];
}
/**
 * 将单个 Markdown 文件解析为 Page
 */
export function parseFile(absPath, relPath, collectionConfig) {
    const collectionName = collectionConfig.name;
    const raw = fs.readFileSync(absPath, "utf8");
    const { data, content } = matter(raw);
    const fm = (data ?? {});
    // slug 与文件名日期
    const base = path.basename(relPath);
    let slug = typeof fm.slug === "string" ? fm.slug : "";
    let datePrefix = null;
    if (!slug) {
        if (base.toLowerCase() === "index.md") {
            slug = path.basename(path.dirname(relPath));
        }
        else {
            const info = parseSlugFromFilename(base);
            slug = info.slug;
            datePrefix = info.datePrefix;
        }
    }
    // date：front-matter → 文件名前缀
    let date = toDate(fm.date);
    if (!date && datePrefix)
        date = new Date(`${datePrefix}T00:00:00`);
    const updated = toDate(fm.updated);
    // 集合需要日期时缺失即报错
    const routePattern = collectionConfig.routePattern ?? "/:collection/:slug/";
    const permalink = typeof fm.permalink === "string" ? fm.permalink : undefined;
    const needsDate = collectionConfig.sortBy === "date" ||
        /:year|:month|:day/.test(routePattern + (permalink ?? ""));
    if (needsDate && !date) {
        throw new Error(`[${relPath}] 集合 "${collectionName}" 需要 date（sortBy: date 或路由含日期变量），请在 front-matter 中提供 date`);
    }
    // draft：front-matter 或 content/drafts/ 目录强制
    const draft = collectionConfig.isDrafts || fm.draft === true;
    // url 生成
    const url = resolveUrl({
        relPath,
        collection: collectionName,
        routePattern,
        permalink,
        slug,
        date,
    });
    // 剩余 front-matter 键值对
    const dataRest = {};
    for (const [k, v] of Object.entries(fm)) {
        if (!RESERVED_KEYS.has(k))
            dataRest[k] = v;
    }
    const id = toPosixPath(relPath);
    const page = {
        // 必要项
        id,
        url,
        title: typeof fm.title === "string" ? fm.title : slug,
        layout: typeof fm.layout === "string" ? fm.layout : collectionConfig.defaultLayout ?? "page",
        // 文章可选项
        date,
        updated,
        draft,
        tags: toStringArray(fm.tags),
        categories: parseCategories(fm.categories),
        link: typeof fm.link === "string" ? fm.link : undefined,
        cover: Array.isArray(fm.cover)
            ? fm.cover.map(String)
            : typeof fm.cover === "string"
                ? fm.cover
                : undefined,
        excerpt: typeof fm.excerpt === "string" ? fm.excerpt : "",
        // 构建生成选项
        collection: collectionName,
        sourcePath: absPath,
        aliases: [],
        slug,
        rawContent: content,
        content: "",
        data: dataRest,
        metadata: {},
    };
    return page;
}
/**
 * parse 阶段
 */
export function seqParse(siteConfig /* TODO 此参数需要移除 */, contentRoot, files) {
    // NOTE
    // 如果想要支持更多的文件类型，比如 html，是不是应该使用 f.type = 'markdown' | 'assets' | 'html' 的方式？
    // 在之后的 render 阶段还可以使用类似 `seqRender(pages, type)` 的方式分类渲染
    // 且注册 render 也可以使用类似 `renderer.registry(type, callback)` 的方式添加额外支持
    // 整合之后还可以考虑使用 `const {pages, assets, unknow} = seqParse(files)` 的方式获取结果
    const mdFiles = files.filter((f) => !f.isAsset);
    const pages = [];
    for (const f of mdFiles) {
        const rel = toPosixPath(path.relative(contentRoot, f.absolutePath));
        // 这里特殊处理一下 drafts 下的文件，将其全部标记为 draft
        const collectionName = rel.split("/")[0];
        let collectionConfig = siteConfig.collections.find((c) => c.sourceDir === collectionName);
        if (!collectionConfig) {
            // TODO 更改为警告，而非抛出错误
            throw new Error(`目录 "${collectionName}" 未配置集合（config.collections 中缺少 sourceDir: "${collectionName}"）\nPath: ${rel}`);
        }
        const page = parseFile(f.absolutePath, rel, collectionConfig);
        pages.push(page);
    }
    return pages;
}
//# sourceMappingURL=parse.js.map