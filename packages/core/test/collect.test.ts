import { test } from "node:test";
import assert from "node:assert/strict";
import { collectVirtual, seqCollect } from "../src/sequence/collect.js";
import { CollectionImpl } from "../src/collection.js";
import type { SiteConfig } from "../src/types/config.js";
import type { Page } from "../src/types/page.js";

function page(id: string, collection: string, date?: Date): Page {
  return {
    id,
    collection,
    url: `/${id}/`,
    title: id,
    layout: "post",
    date,
    tags: [],
    categories: [],
    slug: id,
    draft: false,
    rawContent: "",
    content: "",
    data: {},
    metadata: {},
    sourcePath: null,
  };
}

const config = {
  siteTitle: "t",
  theme: "x",
  themeAssetsMode: "merge",
  collections: [
    { name: "posts", sourceDir: "posts", sortBy: "date" },
    { name: "pages", sourceDir: "pages" },
  ],
} as unknown as SiteConfig;

test("seqCollect: 按配置集合分组，保持配置声明顺序，未知集合忽略", () => {
  const cols = seqCollect(config, [
    page("p1", "posts"),
    page("x", "unknown"),
    page("p2", "pages"),
    page("p3", "posts"),
  ]);
  assert.deepEqual(cols.map((c) => c.name), ["posts", "pages"]);
  assert.deepEqual(cols[0]!.pages.map((p) => p.id), ["p1", "p3"]);
  assert.deepEqual(cols[1]!.pages.map((p) => p.id), ["p2"]);
  // 未配置的集合不产生
  assert.ok(!cols.some((c) => c.name === "unknown"));
});

test("collectVirtual: 已有集合并入、未知集合动态创建、touched 去重", () => {
  const existing = new Map();
  existing.set("posts", new CollectionImpl("posts", { name: "posts", sourceDir: "posts" }, []));
  const touched = collectVirtual(existing, [
    page("v1", "posts"),
    page("v2", "core:virtual"),
    page("v3", "core:virtual"),
    page("v2b", "core:virtual"),
  ]);
  // posts（并入）+ core:virtual（新建）各出现一次
  assert.deepEqual(touched.map((c) => c.name).sort(), ["core:virtual", "posts"]);
  assert.equal(existing.get("posts")!.pages.length, 1);
  const virt = existing.get("core:virtual")!;
  assert.equal(virt.pages.length, 3);
  assert.equal(virt.config.sourceDir, "");
});
