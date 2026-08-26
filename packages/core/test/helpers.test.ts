import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createHelperRegistry,
  type HelperRegistry,
} from "../src/runtime.js";
import { registerCoreHelpers } from "../src/helpers.js";

function registry(): HelperRegistry {
  const reg = createHelperRegistry();
  registerCoreHelpers(reg);
  return reg;
}

test("注册表相互隔离（不累积/不泄漏）", () => {
  const a = createHelperRegistry();
  const b = createHelperRegistry();
  a.register("x", () => 1);
  b.register("x", () => 2);
  assert.equal(a.get("x")!(), 1);
  assert.equal(b.get("x")!(), 2);
  assert.equal(b.get("y"), undefined);
});

test("核心 helpers: date 格式化", () => {
  const reg = registry();
  const d = reg.get("date")!;
  assert.equal(d("2026-08-05"), "2026-08-05");
  // 无 Z 后缀的时间串按本地时间解析，避免受系统时区影响
  assert.equal(d("2026-08-05T10:30:00", "YYYY/MM/DD HH:mm"), "2026/08/05 10:30");
  assert.equal(d(undefined), "");
  assert.equal(d("not-a-date"), "");
});

test("核心 helpers: assetUrl", () => {
  const reg = registry();
  assert.equal(reg.get("assetUrl")!("a.png"), "/assets/a.png");
  assert.equal(reg.get("assetUrl")!("/a.png"), "/assets/a.png");
});

test("核心 helpers: themeAsset 前缀随注册表变化", () => {
  const reg = registry();
  const ta = reg.get("themeAsset")!;
  assert.equal(ta("x.css"), "/assets/x.css");
  reg.setThemeAssetsPrefix("/assets/my-theme");
  assert.equal(ta("x.css"), "/assets/my-theme/x.css");
});

test("核心 helpers: pickCover 确定性选择", () => {
  const reg = registry();
  const pick = reg.get("pickCover")!;
  assert.equal(pick({ cover: "a.png", slug: "s" }), "a.png");
  assert.equal(pick({ cover: undefined, slug: "s" }), null);
  const first = pick({ cover: ["a.png", "b.png"], slug: "hello" });
  assert.ok(["a.png", "b.png"].includes(first));
  assert.equal(pick({ cover: ["a.png", "b.png"], slug: "hello" }), first);
});

test("核心 helpers: urlFor 补前导斜杠", () => {
  const reg = registry();
  assert.equal(reg.get("urlFor")!("a/b"), "/a/b");
  assert.equal(reg.get("urlFor")!("/a/b"), "/a/b");
});

test("核心 helpers: 分页工具 pageUrl/paginate/pinSort", () => {
  const reg = registry();
  const pageUrl = reg.get("pageUrl")!;
  assert.equal(pageUrl("/archive/", "page", 1), "/archive/");
  assert.equal(pageUrl("/archive/", "page", 3), "/archive/page/3/");
  const pinSort = reg.get("pinSort")!;
  const a = { data: { pin: true }, id: "a" };
  const b = { data: {}, id: "b" };
  const c = { data: { pin: true }, id: "c" };
  const sorted = pinSort([b, a, c]);
  assert.deepEqual(sorted.map((p: any) => p.id), ["a", "c", "b"]);
});
