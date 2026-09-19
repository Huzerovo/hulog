import { GeneratorRegistry } from "../types/generator.js";
import { Page, VIRTUAL_PAGE_COLLECTION } from "../types/page.js";
import { Site } from "../types/site.js";
import { Logger } from "../utils.js";

export async function seqGenerate(site: Site, generators: GeneratorRegistry): Promise<Page[]> {
  const generatorLogger = Logger.getLogger("core:generator");
  generatorLogger.setLevel('debug');
  generatorLogger.start();
  const allPages: Page[] = [];
  // generators.forEach(async (fn, name) => {
  for (const [name, fn] of generators.all) {
    generatorLogger.debug("running generator " + name);
    const vPages = await fn(site);
    for (const v of vPages) {
      if (v.collection === VIRTUAL_PAGE_COLLECTION && !v.url.endsWith('/')) {
        v.url += '/';
      }
      allPages.push(v);
    }
  }
  // });
  generatorLogger.end();
  return allPages;
}
