import { CollectionImpl } from "../collection.js";
/**
 * collect①（物理）：在 filter 之后运行，将物理页面按 collection 分组生成集合。
 * 只创建配置声明的集合（物理页必然属于配置集合），按配置声明顺序返回。
 */
export function seqCollect(config, pages) {
    const collections = new Map();
    for (const cfg of config.collections) {
        collections.set(cfg.name, new CollectionImpl(cfg.name, cfg, []));
    }
    for (const page of pages) {
        const col = collections.get(page.collection);
        if (col)
            col.pages.push(page);
    }
    return [...collections.values()];
}
/**
 * collect②（虚拟）：在 generate 之后运行，将虚拟页面挂入 site.collections。
 * 虚拟页 collection 已存在（如某 generator 产出 "posts"）则并入，否则动态创建（如 core:virtual）。
 * 返回受影响（含新建）的集合。
 */
export function collectVirtual(collections, pages) {
    const touched = [];
    const seen = new Set();
    for (const page of pages) {
        let col = collections.get(page.collection);
        if (!col) {
            col = new CollectionImpl(page.collection, {
                name: page.collection,
                sourceDir: "",
            });
            collections.set(page.collection, col);
        }
        col.pages.push(page);
        if (!seen.has(page.collection)) {
            seen.add(page.collection);
            touched.push(col);
        }
    }
    return touched;
}
//# sourceMappingURL=collect.js.map