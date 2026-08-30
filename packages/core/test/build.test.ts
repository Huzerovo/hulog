import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { build } from "../src/build.js";

const tmpDirs: string[] = [];
function tmpRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hulog-build-"));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function write(root: string, rel: string, content: string) {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}

/** 搭建最小站点：config + theme + content + 站点插件 */
function scaffoldSite(): string {
  const root = tmpRoot();
  write(
    root,
    "blog.config.ts",
    `export default {
      siteTitle: "t",
      theme: "default",
      contentDir: "content",
      collections: [
        { name: "posts", sourceDir: "posts", routePattern: "/post/:slug/", sortBy: "date" },
        { name: "drafts", sourceDir: "drafts", routePattern: "/draft/:slug/", isDrafts: true },
      ],
    }`,
  );
  write(root, "themes/default/index.ts", `
    export default function () {
      return { name: "default", layouts: { default: () => null } };
    }`);
  write(root, "content/posts/a.md", "---\ntitle: A\ndate: 2026-01-01\n---\nbody");
  write(root, "content/drafts/d.md", "---\ntitle: D\n---\nbody");
  // 站点插件：注册一个虚拟页 generator，验证虚拟页进入 site.pages
  write(
    root,
    "plugins/generator-test.ts",
    `export default function (api) {
      api.plugins.generators.register("test:v", () => [{
        id: "virtual:test",
        collection: "core:virtual",
        sourcePath: null,
        url: "/virtual/test",
        aliases: [],
        title: "V",
        tags: [],
        categories: [],
        slug: "v",
        layout: "default",
        draft: false,
        rawContent: "",
        content: "",
        data: {},
        metadata: {},
      }]);
    }`,
  );
  return root;
}

test("生产构建：草稿不进入构建，虚拟页进入 site.pages 并渲染到 dist", async () => {
  const root = scaffoldSite();
  const result = await build({ cwd: root });

  const urls = result.pages.map((r) => r.page.url);
  // 草稿被过滤
  assert.ok(!urls.some((u) => u.startsWith("/draft/")), `不应包含草稿: ${urls}`);
  assert.ok(urls.includes("/post/a/"));

  // 虚拟页 url 被规整为 "/" 结尾，进入 site.collections / site.pages
  const v = result.pages.find((r) => r.page.id === "virtual:test");
  assert.ok(v, "站点插件生成的虚拟页应进入构建结果");
  assert.equal(v!.page.url, "/virtual/test/");
  const siteV = result.site.pages.find((p) => p.id === "virtual:test");
  assert.ok(siteV, "虚拟页应进入 site.pages（经 collect 分组）");
  assert.equal(siteV!.url, "/virtual/test/");
  assert.ok(result.site.collections.has("core:virtual"));
  // 输出为 index.html
  assert.ok(fs.existsSync(path.join(root, "dist", "virtual", "test", "index.html")));
});
