import { GeneratorRegistry } from "../types/generator.js";
import { Page, VIRTUAL_PAGE_COLLECTION } from "../types/page.js";
import { Site } from "../types/site.js";

export async function seqGenerate(site: Site, generators: GeneratorRegistry): Promise<Page[]> {
  const allPages: Page[] = [];
  // generators.forEach(async (fn, name) => {
  for (const [name, fn] of generators.all) {
    console.log("  [generate]: running generator " + name);
    const vPages = await fn(site);
    for (const v of vPages) {
      if (v.collection === VIRTUAL_PAGE_COLLECTION && !v.url.endsWith('/')) {
        v.url += '/';
      }
      allPages.push(v);
    }
  }
  // });
  return allPages;
}
