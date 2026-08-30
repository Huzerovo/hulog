import { VIRTUAL_PAGE_COLLECTION, type Page } from "../types/page.js";
import type { PaginateOptions } from "../types/pagination.js";
import type { GeneratorAPI } from "../plugins.js";

/**
 * 首页生成器：posts 集合按 perPage 分页（layout: index）。
 * 第 1 页 /，第 N 页 /page/N/（站点级分页）。
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
  const pinSort = helper.get("pinSort") as (posts: Page[]) => Page[];

  const sortPages = helper.get("sortPages") as (pages: Page[], by: string, order: string) => Page[];

  api.plugins.generators.register("core:home", (site): Page[] => {
    const allPosts = site.collections.get("posts")?.getPages(true) ?? [];

    if (site.config.renderDraft) {
      site.collections.get("drafts")?.getPages(true).forEach((p) => {
        allPosts.push(p);
      });
    }

    const posts = sortPages(allPosts, "date", "desc");
    // const posts = allPosts;

    if (posts.length === 0) return [];
    const perPage = api.config.perPage ?? 10;
    const format = api.config.paginationDir ?? "page";
    return paginate(pinSort(posts), {
      base: "/",
      perPage,
      layout: "index",
      format,
      makePage: ({ posts, pagination }) => ({
        id: `virtual:home:${pagination.current}`,
        collection: VIRTUAL_PAGE_COLLECTION,
        sourcePath: null,
        url: pageUrl("/", format, pagination.current),
        aliases: [],
        title: "首页",
        tags: [],
        categories: [],
        slug: pagination.current === 1 ? "index" : `page-${pagination.current}`,
        layout: "index",
        draft: false,
        rawContent: "",
        content: "",
        data: { posts, pagination },
        metadata: {},
      }),
    });
  });
}
