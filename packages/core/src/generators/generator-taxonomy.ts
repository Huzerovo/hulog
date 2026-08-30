import { VIRTUAL_PAGE_COLLECTION, type CategoryPath, type Page } from "../types/page.js";
import type { PaginateOptions } from "../types/pagination.js";
import type { GeneratorAPI } from "../plugins.js";

/**
 * 分类/标签页生成器：
 * - /categories/<父>/<子>/  分类文章列表（layout: category），支持子分类层级，含分页
 * - /tags/<name>/          标签文章列表（layout: tag），含分页
 *
 * 分类层级规则：每条分类路径的所有祖先也会生成页面（父分类页包含
 * 直接 + 间接子分类的文章，与 Hexo 行为一致）。
 */
export default function(api: GeneratorAPI) {
  const helper = api.plugins.helpers;
  const paginate = helper.get("paginate") as (
    posts: Page[],
    opts: PaginateOptions,
  ) => Page[];
  const pageUrl = helper.get("pageUrl") as (
    base: string,
    format: string,
    n: number,
  ) => string;
  const categoryPathToUrl = helper.get("categoryPathToUrl") as (
    path: CategoryPath,
  ) => string;
  const categoryPathToString = helper.get("categoryPathToString") as (
    path: CategoryPath,
  ) => string;

  api.plugins.generators.register("core:taxonomy", (site): Page[] => {
    const posts = site.collections.get("posts")?.getPages(true) ?? [];
    if (posts.length === 0) return [];
    const perPage = api.config.perPage ?? 10;
    const format = api.config.paginationDir ?? "page";
    const pages: Page[] = [];

    // 分类：按完整路径分组（key = JSON.stringify(path)），祖先路径自动展开
    interface CategoryGroup {
      path: CategoryPath;
      posts: Page[];
      seen: Set<string>;
    }
    const groups = new Map<string, CategoryGroup>();
    for (const p of posts) {
      for (const path of p.categories ?? []) {
        for (let i = 1; i <= path.length; i++) {
          const prefix = path.slice(0, i);
          const key = JSON.stringify(prefix);
          let g = groups.get(key);
          if (!g) {
            g = { path: prefix, posts: [], seen: new Set() };
            groups.set(key, g);
          }
          if (!g.seen.has(p.id)) {
            g.seen.add(p.id);
            g.posts.push(p);
          }
        }
      }
    }
    for (const { path, posts: list } of groups.values()) {
      const base = categoryPathToUrl(path);
      pages.push(
        ...paginate(list, {
          base,
          perPage,
          layout: "category",
          format,
          makePage: ({ posts, pagination }) => ({
            id: `virtual:category:${JSON.stringify(path)}:${pagination.current}`,
            collection: VIRTUAL_PAGE_COLLECTION,
            sourcePath: null,
            url: pageUrl(base, format, pagination.current),
            aliases: [],
            title: path[path.length - 1] ?? "",
            tags: [],
            categories: [],
            slug: `category-${path.join("-")}`,
            layout: "category",
            draft: false,
            rawContent: "",
            content: "",
            data: {
              posts,
              pagination,
              category: categoryPathToString(path),
              categoryPath: path,
            },
            metadata: {},
          }),
        }),
      );
    }

    // 标签
    const tags = new Map<string, Page[]>();
    for (const p of posts) {
      for (const t of p.tags ?? []) {
        if (!tags.has(t)) tags.set(t, []);
        tags.get(t)!.push(p);
      }
    }
    for (const [name, list] of tags) {
      const base = `/tags/${encodeURIComponent(name)}/`;
      pages.push(
        ...paginate(list, {
          base,
          perPage,
          layout: "tag",
          format,
          makePage: ({ posts, pagination }) => ({
            id: `virtual:tag:${name}:${pagination.current}`,
            collection: VIRTUAL_PAGE_COLLECTION,
            sourcePath: null,
            url: pageUrl(base, format, pagination.current),
            aliases: [],
            title: name,
            tags: [],
            categories: [],
            slug: `tag-${name}`,
            layout: "tag",
            draft: false,
            rawContent: "",
            content: "",
            data: { posts, pagination, tag: name },
            metadata: {},
          }),
        }),
      );
    }

    return pages;
  });
}
