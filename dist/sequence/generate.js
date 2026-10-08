import { VIRTUAL_PAGE_COLLECTION } from "../types/page.js";
import { Logger } from "../utils.js";
export async function seqGenerate(site, generators) {
    const generatorLogger = Logger.getLogger("core:build:generator");
    const allPages = [];
    // generators.forEach(async (fn, name) => {
    for (const [name, fn] of generators.all) {
        generatorLogger.info("running generator " + name);
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
//# sourceMappingURL=generate.js.map