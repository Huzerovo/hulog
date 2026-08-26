import type { Page, GeneratorAPI } from "@hulog/core";
import { paginate, pageUrl, pinSort } from "../pagination.js";

/**
 * 首页生成器：posts 集合按 perPage 分页（layout: index）。
 * 第 1 页 /，第 N 页 /page/N/（站点级分页）。
 */
export default function (api: GeneratorAPI) {
  api.generator.register("home", (site): Page[] => {
    const posts = site.getCollection("posts")?.getPages(true) ?? [];
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
        collection: "virtual",
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
