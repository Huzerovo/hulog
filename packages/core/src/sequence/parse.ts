import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { Collection, CollectionConfig } from "../types/collection.js";
import type { FileEntry } from "../types/plugins.js";
import type { Page, PagesIndex } from "../types/page.js";
import type { SiteConfig } from "../types/config.js";
import { parseSlugFromFilename, resolveUrl } from "../route.js";
import { parseCategories } from "../category.js";
import { toPosixPath } from "../path.js";
import { CollectionImpl } from "../site.js";

/** front-matter 中的日期值 → Date（支持 Date、字符串、时间戳） */
function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;
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
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value ? [value] : [];
  return [];
}

// front-matter 字段
const RESERVED_KEYS = new Set([
  "title",
  "date",
  "updated",
  "tags",
  "categories",
  "slug",
  "layout",
  "draft",
  "excerpt",
  "link",
  "cover",
  "permalink",
]);

/**
 * 将单个 Markdown 文件解析为 Page
 */
export function parseFile(
  absPath: string,
  relPath: string,
  collectionConfig: CollectionConfig,
): Page {
  const collectionName = collectionConfig.name;
  const raw = fs.readFileSync(absPath, "utf8");
  const { data, content } = matter(raw);
  const fm = (data ?? {}) as Record<string, unknown>;

  // slug 与文件名日期
  const base = path.basename(relPath);
  let slug = typeof fm.slug === "string" ? fm.slug : "";
  let datePrefix: string | null = null;
  if (!slug) {
    if (base.toLowerCase() === "index.md") {
      slug = path.basename(path.dirname(relPath));
    } else {
      const info = parseSlugFromFilename(base);
      slug = info.slug;
      datePrefix = info.datePrefix;
    }
  }

  // date：front-matter → 文件名前缀
  let date = toDate(fm.date);
  if (!date && datePrefix) date = new Date(`${datePrefix}T00:00:00`);
  const updated = toDate(fm.updated);

  // 集合需要日期时缺失即报错
  const routePattern = collectionConfig.routePattern ?? "/:collection/:slug/";
  const permalink =
    typeof fm.permalink === "string" ? fm.permalink : undefined;
  const needsDate =
    collectionConfig.sortBy === "date" ||
    /:year|:month|:day/.test(routePattern + (permalink ?? ""));
  if (needsDate && !date) {
    throw new Error(
      `[${relPath}] 集合 "${collectionName}" 需要 date（sortBy: date 或路由含日期变量），请在 front-matter 中提供 date`,
    );
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
  const dataRest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fm)) {
    if (!RESERVED_KEYS.has(k)) dataRest[k] = v;
  }

  const id = toPosixPath(relPath);
  const page: Page = {
    id,
    collection: collectionName,
    sourcePath: absPath,
    url,
    aliases: [],
    title: typeof fm.title === "string" ? fm.title : slug,
    date,
    updated,
    tags: toStringArray(fm.tags),
    categories: parseCategories(fm.categories),
    slug,
    layout: typeof fm.layout === "string" ? fm.layout : collectionConfig.defaultLayout ?? "page",
    draft,
    excerpt: typeof fm.excerpt === "string" ? fm.excerpt : undefined,
    link: typeof fm.link === "string" ? fm.link : undefined,
    cover: Array.isArray(fm.cover)
      ? fm.cover.map(String)
      : typeof fm.cover === "string"
        ? fm.cover
        : undefined,
    rawContent: content,
    content: "",
    data: dataRest,
    metadata: {},
  };

  return page;
}

function buildCollections(
  config: SiteConfig,
  pageById: Map<string, Page>,
): Collection[] {
  const cols = config.collections.map((cfg) => {
    const pages = [...pageById.values()].filter(
      (p) => p.collection === cfg.name,
    );
    return new CollectionImpl(cfg.name, cfg, pages);
  });

  // 内置草稿区集合（production 下被 filter 阶段过滤）
  // NOTE 考虑将草稿区集合名设置为可由配置定义
  // const draftPages = [...pageById.values()].filter((p) => p.draft);
  // if (draftPages.length > 0) {
  //   cols.push(new CollectionImpl("drafts", DRAFTS_COLLECTION_CONFIG, draftPages));
  // }
  return cols;
}

/**
 * parse 阶段
 */
export function seqParse(siteConfig: SiteConfig /* TODO 此参数需要移除 */, contentRoot: string, files: FileEntry[]): Collection[] {
  // NOTE
  // 如果想要支持更多的文件类型，比如 html，是不是应该使用 f.type = 'markdown' | 'assets' | 'html' 的方式？
  // 在之后的 render 阶段还可以使用类似 `seqRender(pages, type)` 的方式分类渲染
  // 且注册 render 也可以使用类似 `renderer.registry(type, callback)` 的方式添加额外支持
  // 整合之后还可以考虑使用 `const {pages, assets, unknow} = seqParse(files)` 的方式获取结果
  const mdFiles = files.filter((f) => !f.isAsset);
  const pageById: PagesIndex = new Map<string, Page>();
  // NOTE
  // siteConfig 在 loadSiteConfig 会有默认值，这里这样写会导致太多地方硬编码 "content"
  for (const f of mdFiles) {
    const rel = toPosixPath(path.relative(contentRoot, f.absolutePath));
    const collectionName = rel.split("/")[0]!;
    // TODO
    // 将 collection 移到新的一个阶段，此函数只接受文件
    let collectionConfig = siteConfig.collections.find(
      (c) => c.sourceDir === collectionName,
    );
    // collection 不存在时处理
    // if (!collectionConfig) {
    //   // 内置草稿区：强制 draft，dev 预览
    //   // NOTE 考虑草稿区名称设置为可自定义
    //   if (rel.startsWith("drafts/")) {
    //     collectionConfig = DRAFTS_COLLECTION_CONFIG;
    //   } else {
    //     // NOTE
    //     // 考虑到允许用户在 content 下创建自定义的文件夹，这里改为抛出警告会不会更好一些？
    //     throw new Error(`目录 "${collectionName}" 未配置集合（config.collections 中缺少 sourceDir: "${collectionName}"）`);
    //   }
    // }
    if (!collectionConfig) {
      // TODO 更改为警告，而非抛出错误
      throw new Error(`目录 "${collectionName}" 未配置集合（config.collections 中缺少 sourceDir: "${collectionName}"）\nPath: ${rel}`);
    }
    const page = parseFile(f.absolutePath, rel, collectionConfig);
    pageById.set(page.id, page);
  }
  const collections: Collection[] = buildCollections(siteConfig, pageById);

  return collections;
}
