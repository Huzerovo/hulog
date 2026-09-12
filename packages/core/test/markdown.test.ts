import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "../src/markdown.js";
import type { SiteConfig } from "../src/types/config.js";
import type { Page } from "../src/types/page.js";
import type { AssetRegistry } from "../src/types/renderer.js";

function makeConfig(markdown: SiteConfig["markdown"]): SiteConfig {
  return {
    siteTitle: "t",
    theme: "x",
    themeAssetsMode: "merge",
    collections: [],
    markdown,
  } as SiteConfig;
}

const page: Page = {
  id: "content/posts/p.md",
  collection: "posts",
  sourcePath: null,
  url: "/post/p/",
  aliases: [],
  title: "p",
  tags: [],
  categories: [],
  slug: "p",
  layout: "post",
  draft: false,
  rawContent: "",
  content: "",
  data: {},
  metadata: {},
};

const assets: AssetRegistry = { list: [], resolve: () => null };

const MERMAID_MD = "```mermaid\ngraph TD;\n  A-->B;\n```\n";

test("mermaid 代码块转为 .mermaid 容器（客户端渲染）", async () => {
  const { html } = await renderMarkdown(MERMAID_MD, page, {
    config: makeConfig({ highlight: false, mermaid: true }),
    assets,
  });
  assert.match(html, /class="mermaid"/);
  assert.match(html, /A-->B/);
  assert.doesNotMatch(html, /language-mermaid/);
  // 不应再是代码块
  assert.doesNotMatch(html, /<code/);
});

test("markdown.mermaid=false 时保留普通代码块", async () => {
  const { html } = await renderMarkdown(MERMAID_MD, page, {
    config: makeConfig({ highlight: false, mermaid: false }),
    assets,
  });
  assert.match(html, /class="language-mermaid"/);
  assert.doesNotMatch(html, /class="mermaid"/);
});
