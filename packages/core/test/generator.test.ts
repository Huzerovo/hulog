import { test } from "node:test";
import assert from "node:assert/strict";
import { GeneratorRegistryImpl } from "../src/plugins/generator.js";
import { CollectionImpl } from "../src/collection.js";
import { SiteImpl } from "../src/site.js";
import {
  initCorePlugins,
  registerCoreGenerators,
} from "../src/plugins/index.js";
import type { SiteConfig } from "../src/types/config.js";
import type { Page } from "../src/types/page.js";

/** 构造最小站点（含默认站点配置） */
function makeSite(config: Partial<SiteConfig> = {}): SiteImpl {
  const cfg = {
    siteTitle: "t",
    theme: "default",
    themeAssetsMode: "merge",
    collections: [],
    ...config,
  } as SiteConfig;
  return new SiteImpl(cfg);
}

function mkPage(id: string): Page {
  return {
    id,
    collection: "posts",
    sourcePath: `/content/posts/${id}.md`,
    url: `/post/${id}/`,
    aliases: [],
    title: id,
    date: new Date("2026-01-01"),
    tags: [],
    categories: [],
    slug: id,
    layout: "post",
    draft: false,
    rawContent: "",
    content: "",
    data: {},
    metadata: {},
  };
}

test("register/get/forEach 同名覆盖", () => {
  const reg = new GeneratorRegistryImpl();
  const a = () => [];
  const b = () => [];
  reg.register("home", a);
  assert.equal(reg.get("home"), a);
  reg.register("home", b);
  assert.equal(reg.get("home"), b);

  const seen: string[] = [];
  reg.forEach((fn, name) => seen.push(name));
  assert.deepEqual(seen, ["home"]);
});

test("initCorePlugins 注册内置 generator（core: 前缀）", async () => {
  const { registries } = await initCorePlugins(makeSite(), "/tmp");
  const names: string[] = [];
  registries.generators.forEach((fn, name) => names.push(name));
  assert.deepEqual(names, ["core:home", "core:archives", "core:taxonomy"]);
});

test("registerCoreGenerators 可重复注册（幂等）", async () => {
  const { scoped } = await initCorePlugins(makeSite(), "/tmp");
  registerCoreGenerators(scoped.generator);
  const names: string[] = [];
  scoped.generator.generator.forEach((fn, name) => names.push(name));
  assert.deepEqual(names, ["core:home", "core:archives", "core:taxonomy"]);
});

test("内置 generator 生成 virtual 页面（site 有 posts 时）", async () => {
  const site = makeSite();
  site.collections.set(
    "posts",
    new CollectionImpl(
      "posts",
      { name: "posts", sourceDir: "posts", sortBy: "date" },
      [mkPage("a"), mkPage("b")],
    ),
  );
  const { registries } = await initCorePlugins(site, "/tmp");

  const home = registries.generators.get("core:home")!;
  const homePages = await home(site);
  assert.ok(homePages.length >= 1);
  assert.ok(homePages.every((p) => p.collection === "core:virtual"));
});

test("scoped generator API 暴露 generator 与 helper，不暴露 hook/renderer", async () => {
  const { scoped } = await initCorePlugins(makeSite(), "/tmp");
  assert.ok(scoped.generator.generator);
  assert.ok(scoped.generator.helper);
  assert.equal((scoped.generator as any).hook, undefined);
  assert.equal((scoped.generator as any).renderer, undefined);
  // hook API 仅 hook
  assert.ok(scoped.hook.hook);
  assert.equal((scoped.hook as any).helper, undefined);
});
