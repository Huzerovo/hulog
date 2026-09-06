import { GeneratorCallback, Page, Site, VIRTUAL_PAGE_COLLECTION } from "../types";

export async function seqGenerate(site: Site, callbacks: GeneratorCallback[]): Promise<Page[]> {
  const allPages: Page[] = [];
  for (const fn of callbacks) {
    const vPages = await fn(site);
    for (const v of vPages) {
      if (v.collection === VIRTUAL_PAGE_COLLECTION && !v.url.endsWith('/')) {
        v.url += '/';
      }
      allPages.push(v);
    }
  }
  return allPages;
}
