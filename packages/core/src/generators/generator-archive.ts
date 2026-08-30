import { VIRTUAL_PAGE_COLLECTION, type Page } from "../types/page.js";
import type { PaginateOptions } from "../types/pagination.js";
import type { GeneratorAPI } from "../plugins.js";
import { ARCHIVES_BASE } from "../types/config.js";

/**
 * 归档生成器（参考 huzerovo scripts/generator/archive_page.js）：
 * - /archives/            全部文章按年份分组（layout: archives），含分页
 * - /archives/<year>/     单年归档（layout: archives）
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

  api.plugins.generators.register("core:archives", (sitePages): Page[] => {
    const posts = sitePages.filter(
      (p) => p.collection === "posts" && p.date,
    );
    if (posts.length === 0) return [];
    const archivesDir = api.config.archivesDir ?? ARCHIVES_BASE;
    const format = api.config.paginationDir ?? "page";
    const perPage = api.config.perPage ?? 10;
    const base = `/${archivesDir}/`;
    const pages: Page[] = [];

    // 年份分组（降序）
    const byYear = new Map<number, Page[]>();
    for (const p of posts) {
      const y = p.date!.getFullYear();
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y)!.push(p);
    }
    const years = [...byYear.keys()].sort((a, b) => b - a);

    // 全部归档 + 分页
    pages.push(
      ...paginate(posts, {
        base,
        perPage,
        layout: "archives",
        format,
        makePage: ({ posts, pagination }) => ({
          id: `virtual:archives:${pagination.current}`,
          collection: VIRTUAL_PAGE_COLLECTION,
          sourcePath: null,
          url: pageUrl(base, format, pagination.current),
          aliases: [],
          title: "归档",
          tags: [],
          categories: [],
          slug: "archives",
          layout: "archives",
          draft: false,
          rawContent: "",
          content: "",
          data: { posts, pagination, years },
          metadata: {},
        }),
      }),
    );

    // 单年归档
    for (const year of years) {
      pages.push({
        id: `virtual:archives:${year}`,
        collection: VIRTUAL_PAGE_COLLECTION,
        sourcePath: null,
        url: `/${archivesDir}/${year}/`,
        aliases: [],
        title: `${year} 归档`,
        tags: [],
        categories: [],
        slug: `archive-${year}`,
        layout: "archives",
        draft: false,
        rawContent: "",
        content: "",
        data: { posts: byYear.get(year)!, pagination: undefined, years, year },
        metadata: {},
      });
    }

    return pages;
  });
}
