import type { Page, PaginateOptions, GeneratorAPI } from "@hulog/core";

/**
 * 归档生成器（参考 huzerovo scripts/generator/archive_page.js）：
 * - /archive/            全部文章按年份分组（layout: archive），含分页
 * - /archive/<year>/     单年归档（layout: archive）
 */
export default function (api: GeneratorAPI) {
  const helper = api.plugins.helper;
  const paginate = helper.get("paginate") as (
    posts: Page[],
    opts: PaginateOptions,
  ) => Page[];
  const pageUrl = helper.get("pageUrl") as (
    base: string,
    format: string,
    n: number,
  ) => string;

  api.plugins.generator.register("archive", (site): Page[] => {
    const posts = (site.getCollection("posts")?.getPages(true) ?? []).filter(
      (p) => p.date,
    );
    if (posts.length === 0) return [];
    const archiveDir = api.config.archiveDir ?? "archive";
    const format = api.config.paginationDir ?? "page";
    const perPage = api.config.perPage ?? 10;
    const base = `/${archiveDir}/`;
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
        layout: "archive",
        format,
        makePage: ({ posts, pagination }) => ({
          id: `virtual:archive:${pagination.current}`,
          collection: "virtual",
          sourcePath: null,
          url: pageUrl(base, format, pagination.current),
          aliases: [],
          title: "归档",
          tags: [],
          categories: [],
          slug: "archive",
          layout: "archive",
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
        id: `virtual:archive:${year}`,
        collection: "virtual",
        sourcePath: null,
        url: `/${archiveDir}/${year}/`,
        aliases: [],
        title: `${year} 归档`,
        tags: [],
        categories: [],
        slug: `archive-${year}`,
        layout: "archive",
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
