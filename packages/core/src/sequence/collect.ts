import { CollectionImpl } from "../site.js";
import type { Collection } from "../types/collection.js";
import type { SiteConfig } from "../types/config.js";
import type { Page } from "../types/page.js";

function buildCollections(
  config: SiteConfig,
  pages: Page[],
): Collection[] {
  const cols = config.collections.map((cfg) => {
    const cPages = pages.filter(
      (p) => p.collection === cfg.name,
    );
    return new CollectionImpl(cfg.name, cfg, cPages);
  });

  // 内置草稿区集合（production 下被 filter 阶段过滤）
  // NOTE 考虑将草稿区集合名设置为可由配置定义
  // const draftPages = [...pageById.values()].filter((p) => p.draft);
  // if (draftPages.length > 0) {
  //   cols.push(new CollectionImpl("drafts", DRAFTS_COLLECTION_CONFIG, draftPages));
  // }
  return cols;
}


export function seqCollect(config: SiteConfig, pages: Page[]): Collection[] {

  return buildCollections(config, pages);
}
