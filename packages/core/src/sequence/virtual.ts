import { Page, RESERVED_KEYS, VirtualPage, } from "../types/page.js";
import { SiteConfig } from "../types/config.js";


function VirtualPageToPage(vPage: VirtualPage): Page {

  let dataRest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(vPage)) {
    if (!RESERVED_KEYS.has(k)) dataRest[k] = v;
  }

  return {
    id: vPage.id,
    collection: "virtual",
    sourcePath: null,
    url: vPage.url,
    title: vPage.title,
    layout: vPage.layout,
    draft: false,
    rawContent: '',
    content: "",
    data: dataRest,
    metadata: {},
  };
}
export function seqVirtual(config: SiteConfig): Page[] {
  const pages: Page[] = [];
  for (let vPage of config.virtualPages) {
    let dataRest: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(vPage)) {
      if (!RESERVED_KEYS.has(k)) dataRest[k] = v;
    }
    const page = VirtualPageToPage(vPage);
    pages.push(page);
    // pageById.set(page.id, page);
  }
  return pages;
}
