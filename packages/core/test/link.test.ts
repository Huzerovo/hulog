import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { HelperRegistryImpl, registerCoreHelpers } from "../src/plugins/helper.js";
import { initHooks } from "../src/plugins/hook.js";
import { registerCoreHooks } from "../src/plugins/builtin/hook-link.js";
import { SiteImpl } from "../src/site.js";
import { CollectionImpl } from "../src/collection.js";
import { build } from "../src/build.js";
import type { SiteConfig } from "../src/types/config.js";
import type { Page } from "../src/types/page.js";

const tmpDirs: string[] = [];
function tmpRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hulog-link-"));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function mkPage(
  id: string,
  title: string,
  url: string,
  collection = "posts",
): Page {
  return {
    id,
    collection,
    url,
    title,
    layout: "post",
    slug: id,
    draft: false,
    tags: [],
    categories: [],
    rawContent: "",
    content: "",
    data: {},
    metadata: {},
    sourcePath: null,
  };
}

function makeSite(): SiteImpl {
  const site = new SiteImpl({
    siteTitle: "t",
    theme: "x",
    themeAssetsMode: "merge",
    collections: [],
  } as unknown as SiteConfig);
  site.collections.set(
    "posts",
    new CollectionImpl("posts", { name: "posts", sourceDir: "posts" }, [
      mkPage("content/posts/a.md", "文章A", "/post/a/"),
      mkPage("content/posts/c.md", "文章[C]", "/post/c/"),
    ]),
  );
  // 非 posts 集合（回退查找）
  site.collections.set(
    "analysis",
    new CollectionImpl("analysis", { name: "analysis", sourceDir: "analysis" }, [
      mkPage("content/analysis/x.md", "分析文章", "/analysis/x/", "analysis"),
    ]),
  );
  return site;
}

function makeHelper(site: SiteImpl): HelperRegistryImpl {
  const helper = new HelperRegistryImpl(site);
  registerCoreHelpers(helper);
  return helper;
}

test("helper: linkToPost 生成 Markdown 链接（支持集合参数）", () => {
  const helper = makeHelper(makeSite());
  const linkToPost = helper.get("linkToPost") as (t: string, c?: string) => string;

  // 默认：显示文本 = 标题
  assert.equal(linkToPost("文章A"), "[文章A](/post/a/)");
  // 不传集合：posts 优先，非虚拟页回退
  assert.equal(linkToPost("分析文章"), "[分析文章](/analysis/x/)");
  // 第二参数限定集合
  assert.equal(linkToPost("分析文章", "analysis"), "[分析文章](/analysis/x/)");
  assert.equal(linkToPost("文章A", "posts"), "[文章A](/post/a/)");
  assert.equal(linkToPost("文章A", "analysis"), "");
  assert.equal(linkToPost("文章A", "not-exist"), "");
  // 未命中 / 空标题
  assert.equal(linkToPost("不存在"), "");
  assert.equal(linkToPost("  "), "");
  // 标题中的 Markdown 特殊字符转义
  assert.equal(linkToPost("文章[C]"), "[文章\\[C\\]](/post/c/)");
});

test("hook: markdown 占位展开为链接（集合/围栏/未命中）", async () => {
  const helper = makeHelper(makeSite());
  const hooks = initHooks();
  registerCoreHooks(hooks, helper);

  const page = mkPage("content/posts/b.md", "文章B", "/post/b/");
  page.rawContent = [
    '默认：{{linkToPost("文章A")}}',
    '集合：{{linkToPost("分析文章", "analysis")}}',
    '集合不匹配：{{linkToPost("文章A", "analysis")}}',
    "",
    "```md",
    '{{linkToPost("文章A")}}',
    "```",
    "",
    "单引号：{{ linkToPost('文章A') }}",
    "",
    '未命中：{{linkToPost("不存在的文章")}}',
  ].join("\n");

  await hooks.beforeRender.call(page);

  assert.ok(page.rawContent.includes("默认：[文章A](/post/a/)"));
  assert.ok(page.rawContent.includes("集合：[分析文章](/analysis/x/)"));
  assert.ok(page.rawContent.includes("单引号：[文章A](/post/a/)"));
  // 集合不匹配：占位保持原样
  assert.ok(page.rawContent.includes('{{linkToPost("文章A", "analysis")}}'));
  // 围栏内保持原样（未被替换）
  assert.ok(page.rawContent.includes('{{linkToPost("文章A")}}'));
  // 未命中：占位保持原样
  assert.ok(page.rawContent.includes('{{linkToPost("不存在的文章")}}'));
});

test("构建集成：markdown 中 {{linkToPost(...)}} 渲染为真实链接", async () => {
  const root = tmpRoot();
  const write = (rel: string, content: string) => {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  write(
    "blog.config.ts",
    `export default {
      siteTitle: "t",
      theme: "default",
      contentDir: "content",
      markdown: { highlight: false },
      collections: [
        { name: "posts", sourceDir: "posts", routePattern: "/post/:slug/", defaultLayout: "post", sortBy: "date" },
      ],
    }`,
  );
  write("themes/default/index.ts", `
    export default { name: "default", layouts: { default: () => null } }`);
  write("content/posts/a.md", "---\ntitle: 文章A\ndate: 2026-01-01\n---\nA 内容");
  write(
    "content/posts/b.md",
    [
      "---",
      "title: 文章B",
      "date: 2026-01-02",
      "---",
      '推荐：{{linkToPost("文章A")}}',
      "",
      "单引号：{{ linkToPost('文章A') }}",
      "",
      "```md",
      '{{linkToPost("文章A")}}',
      "```",
    ].join("\n"),
  );

  const result = await build({ cwd: root });
  const b = result.pages.find((r) => r.page.title === "文章B")!;
  // 渲染为真实链接（等价写法）
  assert.ok(b.page.content.includes('href="/post/a/">文章A</a>'));
  // 围栏代码块内保留原始占位（未被替换）
  assert.ok(b.page.content.includes("linkToPost"));
  assert.equal(b.page.content.split('href="/post/a/"').length - 1, 2);
});
