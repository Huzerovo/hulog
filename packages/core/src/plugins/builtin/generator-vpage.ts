import { GeneratorAPI, Page, PageBase, Site } from "../../types";

export default function(api: GeneratorAPI) {
  const virtualPage = api.helper.get("virtualPage") as (page: PageBase) => Page;
  api.generator.register("core:vpage", (site: Site): Page[] => {
    const vPages = site.config.virtualPages ?? [];
    const pages = [];
    for (const vp of vPages) {
      pages.push(virtualPage(vp));
    }
    return pages;
  });
}
