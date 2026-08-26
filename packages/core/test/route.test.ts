import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseSlugFromFilename,
  slugFromFile,
  fillRoutePattern,
  resolveUrl,
  siteUrl,
} from "../src/route.js";
import type { SiteConfig } from "../src/types/config.js";

const config = (url: string): SiteConfig => ({
  siteTitle: "t",
  theme: "x",
  collections: [],
  url,
});

test("parseSlugFromFilename: 日期前缀", () => {
  assert.deepEqual(parseSlugFromFilename("2026-08-05-hello.md"), {
    slug: "hello",
    datePrefix: "2026-08-05",
  });
});

test("parseSlugFromFilename: 无日期前缀", () => {
  assert.deepEqual(parseSlugFromFilename("hello.md"), {
    slug: "hello",
    datePrefix: null,
  });
});

test("slugFromFile: index.md 取父目录名", () => {
  assert.deepEqual(slugFromFile("pages/about/index.md"), {
    slug: "about",
    datePrefix: null,
  });
});

test("fillRoutePattern: 变量替换与 URL 编码", () => {
  const d = new Date("2026-08-05T00:00:00");
  assert.equal(
    fillRoutePattern("/post/:slug/", { slug: "你好", collection: "posts", date: d }),
    "/post/%E4%BD%A0%E5%A5%BD/",
  );
  assert.equal(
    fillRoutePattern("/:year/:month/:day/:slug/", {
      slug: "x",
      collection: "posts",
      date: d,
    }),
    "/2026/08/05/x/",
  );
  // 无日期时不渲染日期段（替换为空并折叠）
  assert.equal(
    fillRoutePattern("/:year/:month/:day/:slug/", {
      slug: "x",
      collection: "posts",
      date: null,
    }),
    "/x/",
  );
});

test("fillRoutePattern: 自动补全首尾斜杠", () => {
  assert.equal(
    fillRoutePattern("post/:slug", { slug: "a", collection: "posts", date: null }),
    "/post/a/",
  );
});

test("resolveUrl: 默认文件系统映射", () => {
  assert.equal(
    resolveUrl({ relPath: "posts/hello.md", collection: "posts", slug: "hello" }),
    "/posts/hello/",
  );
  assert.equal(
    resolveUrl({ relPath: "pages/about/index.md", collection: "pages", slug: "about" }),
    "/pages/about/",
  );
});

test("resolveUrl: routePattern 优先于文件系统", () => {
  assert.equal(
    resolveUrl({
      relPath: "posts/hello.md",
      collection: "posts",
      routePattern: "/post/:slug/",
      slug: "hello",
    }),
    "/post/hello/",
  );
});

test("resolveUrl: permalink 最高优先级且支持日期变量", () => {
  const d = new Date("2026-08-05T00:00:00");
  assert.equal(
    resolveUrl({
      relPath: "posts/hello.md",
      collection: "posts",
      permalink: "/p/:year/:slug/",
      slug: "hello",
      date: d,
    }),
    "/p/2026/hello/",
  );
});

test("siteUrl: 拼接站点根", () => {
  assert.equal(siteUrl(config("https://example.com"), "/post/a/"), "https://example.com/post/a/");
  assert.equal(siteUrl(config(""), "/post/a/"), "/post/a/");
});
