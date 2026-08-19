import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { parseFile } from "../src/parse.js";
import type { CollectionConfig } from "../src/types/index.js";

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

/** 本地时区的 YYYY-MM-DD（gray-matter/js-yaml 以本地时间解析日期，不能用 toISOString） */
function localDate(d: Date | undefined): string | undefined {
  if (!d || isNaN(d.getTime())) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const posts: CollectionConfig = {
  name: "posts",
  sourceDir: "posts",
  routePattern: "/post/:slug/",
  defaultLayout: "post",
  sortBy: "date",
};
// 草稿区配置：无需 date（对应 build.ts 的 DRAFTS_COLLECTION_CONFIG）
  const drafts: CollectionConfig = {
    name: "drafts",
    sourceDir: "drafts",
    routePattern: "/draft/:slug/",
    defaultLayout: "post",
  };

function parse(relPath: string, content: string, collection = posts) {
  const root = tmpRoot();
  const file = path.join(root, relPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return parseFile(file, relPath, collection.name, collection);
}

test("front-matter 字段映射与 data 透传", () => {
  const p = parse(
    "posts/hello.md",
    `---\ntitle: Hello\ndate: 2026-08-05\ntags: [a, b]\ncustom: x\n---\nbody`,
  );
  assert.equal(p.title, "Hello");
  assert.equal(localDate(p.date), "2026-08-05");
  assert.deepEqual(p.tags, ["a", "b"]);
  assert.equal(p.data.custom, "x");
  assert.equal(p.url, "/post/hello/");
  assert.equal(p.draft, false);
  assert.equal(p.layout, "post");
  assert.equal(p.rawContent, "body");
});

test("文件名日期前缀作为 date 回退", () => {
  const p = parse("posts/2026-08-05-hello.md", "---\ntitle: Hello\n---\n");
  assert.equal(localDate(p.date), "2026-08-05");
  assert.equal(p.slug, "hello");
});

test("collection 需要日期时缺失即报错", () => {
  assert.throws(() => parse("posts/hello.md", "---\ntitle: Hello\n---\n"), /需要 date/);
});

test("drafts/ 目录强制 draft（草稿集合不要求 date）", () => {
  const p = parse("drafts/note.md", "---\ntitle: Note\n---\n", drafts);
  assert.equal(p.draft, true);
  assert.equal(p.url, "/draft/note/");
});

test("front-matter draft 标记", () => {
  const p = parse("posts/x.md", "---\ntitle: X\ndraft: true\ndate: 2026-01-01\n---\n");
  assert.equal(p.draft, true);
});

test("permalink 覆盖 routePattern", () => {
  const p = parse(
    "posts/x.md",
    `---\ntitle: X\npermalink: /y/:year/:month/:day/:slug/\ndate: 2026-08-05\n---\n`,
  );
  assert.equal(p.url, "/y/2026/08/05/x/");
});

test("slug 缺省用文件名，title 缺省用 slug", () => {
  const p = parse("posts/hello.md", "---\ndate: 2026-01-01\n---\n");
  assert.equal(p.slug, "hello");
  assert.equal(p.title, "hello");
});

test("cover 支持单路径与候选数组", () => {
  const single = parse("posts/a.md", '---\ntitle: A\ndate: 2026-01-01\ncover: a.png\n---\n');
  assert.equal(single.cover, "a.png");
  const multi = parse("posts/b.md", '---\ntitle: B\ndate: 2026-01-01\ncover: [a.png, b.png]\n---\n');
  assert.deepEqual(multi.cover, ["a.png", "b.png"]);
});
