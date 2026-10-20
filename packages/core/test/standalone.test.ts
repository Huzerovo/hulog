import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdownFile } from "../src/standalone.js";

const tmpDirs: string[] = [];
function tmpRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hulog-md-"));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function write(root: string, rel: string, content: string | Buffer) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/** 1x1 PNG */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** 最小可用主题：post 布局输出 html/head/body，引用主题 CSS/JS */
function scaffoldSite(): string {
  const root = tmpRoot();
  write(
    root,
    "blog.config.ts",
    `export default {
      siteTitle: "T",
      theme: "default",
      collections: [
        { name: "posts", sourceDir: "posts", routePattern: "/:slug/", defaultLayout: "post" },
      ],
    };`,
  );
  write(
    root,
    "themes/default/index.ts",
    `import { h } from "preact";
    export default {
      name: "default",
      config: {},
      layouts: {
        post: ({ page, api }: any) => h("html", null,
          h("head", null,
            h("link", { rel: "stylesheet", href: api.helper.get("themeAsset")("css/main.css") }),
            h("link", { rel: "stylesheet", href: "https://cdn.example.com/x.css" }),
          ),
          h("body", null,
            h("h1", null, page.title),
            h("article", { dangerouslySetInnerHTML: { __html: page.content } }),
            h("script", { src: api.helper.get("themeAsset")("js/app.js") }),
          ),
        ),
      },
    };`,
  );
  write(
    root,
    "themes/default/assets/css/main.less",
    "body { background: url(../img/bg.png); color: #333; }",
  );
  write(root, "themes/default/assets/css/_partial.less", ".x { color: red; }");
  write(root, "themes/default/assets/img/bg.png", PNG);
  write(root, "themes/default/assets/js/app.js", "console.log('app');");
  return root;
}

test("renderMarkdownFile: 无 front-matter 的 md → 自包含 HTML", async () => {
  const root = scaffoldSite();
  const md = path.join(root, "demo.md");
  write(root, "demo.md", "# 我的标题\n\n正文段落。\n\n![图](img/pic.png)\n");
  write(root, "img/pic.png", PNG);

  const result = await renderMarkdownFile({ file: md, root });
  const html = fs.readFileSync(result.outFile, "utf8");

  // 默认输出同名 .html
  assert.equal(result.outFile, path.join(root, "demo.html"));
  // 标题取首个 H1 且从正文移除（只出现一次）
  assert.equal((html.match(/我的标题/g) ?? []).length, 1);
  assert.ok(html.includes("正文段落"));
  // 主题 CSS/JS 内联，本地资源不残留
  assert.ok(html.includes("<style>"));
  assert.ok(html.includes("color: #333"));
  assert.ok(html.includes("<script>console.log('app');</script>"));
  assert.ok(!html.includes('href="/assets/css/main.css"'));
  assert.ok(!html.includes('src="/assets/js/app.js"'));
  // CSS 相对 url 与正文图片均内联为 data URI
  assert.ok(html.includes("data:image/png;base64,"));
  assert.ok(!html.includes('src="img/pic.png"'));
  // 外部 CDN 样式保持外链
  assert.ok(html.includes('href="https://cdn.example.com/x.css"'));
  // less partial 不输出
  assert.ok(!html.includes(".x { color: red; }"));
});

test("renderMarkdownFile: 无站点配置时必须显式指定主题", async () => {
  const root = tmpRoot();
  write(root, "a.md", "# A\n");
  await assert.rejects(
    () => renderMarkdownFile({ file: path.join(root, "a.md"), root }),
    /--theme/,
  );

  const themeDir = path.join(root, "themes", "default");
  write(
    root,
    "themes/default/index.ts",
    `import { h } from "preact";
    export default { name: "default", layouts: {
      post: ({ page }: any) => h("html", null, h("body", null, h("h1", null, page.title))),
    } };`,
  );
  const res = await renderMarkdownFile({
    file: path.join(root, "a.md"),
    root,
    theme: themeDir,
  });
  assert.ok(res.html.includes("<h1>A</h1>"));
});

test("renderMarkdownFile: --title 覆盖标题且保留正文 H1", async () => {
  const root = scaffoldSite();
  write(root, "b.md", "# 原标题\n\n内容\n");
  const res = await renderMarkdownFile({
    file: path.join(root, "b.md"),
    root,
    title: "自定义标题",
  });
  assert.ok(res.html.includes("<h1>自定义标题</h1>"));
  // 正文 H1 保留 → 共两个 h1（正文 h1 带 id 属性）
  assert.equal((res.html.match(/<h1\b/g) ?? []).length, 2);
});
