import { test } from "node:test";
import assert from "node:assert/strict";
import { GeneratorRegistryImpl } from "../src/generator.js";
import {
  initCorePlugins,
  registerCoreGenerators,
} from "../src/plugins.js";
import type { Page } from "../src/types/page.js";

const baseConfig = {
  siteTitle: "t",
  theme: "default",
  collections: [],
};

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

test("initCorePlugins 注册内置 generator", () => {
  const api = initCorePlugins(baseConfig, "/tmp");
  const names: string[] = [];
  api.plugins.generators.forEach((fn, name) => names.push(name));
  assert.deepEqual(names, ["home", "archive", "taxonomy"]);
});

test("registerCoreGenerators 可重复注册（幂等）", () => {
  const api = initCorePlugins(baseConfig, "/tmp");
  registerCoreGenerators(api);
  const names: string[] = [];
  api.plugins.generators.forEach((fn, name) => names.push(name));
  assert.deepEqual(names, ["home", "archive", "taxonomy"]);
});

test("内置 generator 生成 virtual 页面（site 有 posts 时）", async () => {
  const api = initCorePlugins(baseConfig, "/tmp");
  const mkPage = (id: string): Page => ({
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
  });
  const site = {
    getCollection: (name: string) =>
      name === "posts"
        ? { name, config: {}, getPages: () => [mkPage("a"), mkPage("b")] }
        : undefined,
  } as any;

  const home = api.plugins.generators.get("home")!;
  const homePages = await home(site);
  assert.ok(homePages.length >= 1);
  assert.ok(homePages.every((p) => p.collection === "virtual"));
});
