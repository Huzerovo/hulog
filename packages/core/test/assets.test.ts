import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveAssetRef,
  scanAssets,
  scanDirectoryAssets,
  type ResolveContext,
} from "../src/assets.js";
import type { Page } from "../src/types/index.js";

const tmpDirs: string[] = [];
function tmpRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hulog-test-"));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function makePage(id: string, sourcePath: string | null, url: string): Page {
  return {
    id,
    collection: "posts",
    sourcePath,
    url,
    aliases: [],
    title: id,
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

test("resolveAssetRef: 外部/锚点/查询串原样保留", () => {
  const root = tmpRoot();
  const ctx: ResolveContext = { assetsDirAbs: root, assets: [], postDirByPageId: new Map() };
  const page = makePage("p", null, "/post/p/");
  assert.equal(resolveAssetRef("https://x.com/a.png", page, ctx), "https://x.com/a.png");
  assert.equal(resolveAssetRef("//cdn.com/a.png", page, ctx), "//cdn.com/a.png");
  assert.equal(resolveAssetRef("#anchor", page, ctx), "#anchor");
  assert.equal(resolveAssetRef("data:image/png;base64,xx", page, ctx), "data:image/png;base64,xx");
});

test("resolveAssetRef: /assets/ 绝对路径校验全局资源", () => {
  const root = tmpRoot();
  fs.mkdirSync(path.join(root, "assets"), { recursive: true });
  fs.writeFileSync(path.join(root, "assets", "a.css"), "x");
  const ctx: ResolveContext = {
    assetsDirAbs: path.join(root, "assets"),
    assets: [],
    postDirByPageId: new Map(),
  };
  const page = makePage("p", null, "/post/p/");
  assert.equal(resolveAssetRef("/assets/a.css", page, ctx), "/assets/a.css");
  assert.equal(resolveAssetRef("/assets/missing.css", page, ctx), null);
});

test("resolveAssetRef: 专属目录命中返回相对引用", () => {
  const root = tmpRoot();
  const postDir = path.join(root, "posts", "hello");
  fs.mkdirSync(postDir, { recursive: true });
  fs.writeFileSync(path.join(postDir, "hero.png"), "img");
  const ctx: ResolveContext = {
    assetsDirAbs: path.join(root, "assets"),
    assets: [],
    postDirByPageId: new Map([["content/posts/hello.md", postDir]]),
  };
  const page = makePage("content/posts/hello.md", path.join(root, "posts/hello.md"), "/post/hello/");
  assert.equal(resolveAssetRef("hero.png", page, ctx), "hero.png");
  assert.equal(resolveAssetRef("missing.png", page, ctx), null);
});

test("resolveAssetRef: 全局目录命中重写为 /assets/", () => {
  const root = tmpRoot();
  const assetsDirAbs = path.join(root, "assets");
  fs.mkdirSync(assetsDirAbs, { recursive: true });
  fs.writeFileSync(path.join(assetsDirAbs, "logo.png"), "img");
  const ctx: ResolveContext = { assetsDirAbs, assets: [], postDirByPageId: new Map() };
  const page = makePage("p", null, "/post/p/");
  assert.equal(resolveAssetRef("logo.png", page, ctx), "/assets/logo.png");
});

test("scanAssets: 专属/全局/散落三类资源", () => {
  const root = tmpRoot();
  const contentRoot = path.join(root, "content");
  const postDir = path.join(contentRoot, "posts", "hello");
  fs.mkdirSync(postDir, { recursive: true });
  fs.writeFileSync(path.join(contentRoot, "posts", "hello.md"), "# h");
  fs.writeFileSync(path.join(postDir, "hero.png"), "img");
  fs.writeFileSync(path.join(contentRoot, "loose.txt"), "x");
  const assetsDirAbs = path.join(root, "assets");
  fs.mkdirSync(assetsDirAbs, { recursive: true });
  fs.writeFileSync(path.join(assetsDirAbs, "logo.png"), "img");

  const page = makePage("content/posts/hello.md", path.join(contentRoot, "posts", "hello.md"), "/post/hello/");
  const result = scanAssets({ contentRoot, assetsDirAbs, pages: [page] });

  assert.deepEqual(result.stray, ["loose.txt"]);
  assert.equal(result.postDirByPageId.get("content/posts/hello.md"), postDir);
  const postAsset = result.assets.find((a) => a.belongsTo === "content/posts/hello.md");
  assert.equal(postAsset?.url, "/post/hello/hero.png");
  assert.equal(postAsset?.type, "image");
  const globalAsset = result.assets.find((a) => a.url === "/assets/logo.png");
  assert.equal(globalAsset?.belongsTo, "global");
});

test("scanDirectoryAssets: 递归收集并推断类型", () => {
  const root = tmpRoot();
  fs.mkdirSync(path.join(root, "css"), { recursive: true });
  fs.writeFileSync(path.join(root, "a.css"), "a");
  fs.writeFileSync(path.join(root, "css", "b.js"), "b");
  const assets = scanDirectoryAssets(root, "/assets");
  assert.equal(assets.length, 2);
  assert.ok(assets.some((a) => a.url === "/assets/a.css" && a.type === "css"));
  assert.ok(assets.some((a) => a.url === "/assets/css/b.js" && a.type === "js"));
});
