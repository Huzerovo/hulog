import fs from "node:fs";
import path from "node:path";
import { BIN_NAME } from "@hulog/core";

const CONFIG_TEMPLATE = `import { defineConfig } from "@hulog/core";

export default defineConfig({
  siteTitle: "My Blog",
  description: "A static blog",
  url: "https://example.com",
  theme: "my-theme",
  content: {
    rootDir: "content",
  },
  assetsDir: "assets",
  collections: [
    {
      name: "posts",
      sourceDir: "posts",
      routePattern: "/post/:slug/",
      defaultLayout: "post",
      sortBy: "date",
      sortOrder: "desc",
    },
    {
      name: "pages",
      sourceDir: "pages",
      routePattern: "/:slug/",
      defaultLayout: "page",
    },
  ],
  markdown: {
    highlight: true,
    katex: true,
  },
  server: {
    port: 3000,
    hot: true,
  },
  cli: {
    newPostDraft: true,
  },
});
`;

const THEME_CONFIG_TEMPLATE = `/**
 * 主题配置（可选）：独立于 blog.config.ts，覆盖主题自带默认配置。
 * 不创建此文件时使用主题默认配置；这里只写需要覆盖的键即可。
 */
export default {
  // 示例：
  // menu: { home: { title: "首页", link: "/" } },
};
`;

export function initCmd(dir: string) {
  const target = path.resolve(process.cwd(), dir);
  if (fs.existsSync(path.join(target, "blog.config.ts"))) {
    console.error("目标目录已存在 blog.config.ts，已中止");
    process.exit(1);
  }
  const dirs = [
    "content/posts",
    "content/drafts",
    "content/pages",
    "themes",
    "assets",
    "public",
  ];
  for (const d of dirs) {
    fs.mkdirSync(path.join(target, d), { recursive: true });
  }
  fs.writeFileSync(path.join(target, "blog.config.ts"), CONFIG_TEMPLATE);
  fs.writeFileSync(path.join(target, "theme.config.ts"), THEME_CONFIG_TEMPLATE);
  fs.writeFileSync(
    path.join(target, "content/pages/about.md"),
    `---\ntitle: 关于我\nlayout: page\n---\n\n这里写关于你的介绍。\n`,
  );
  fs.writeFileSync(
    path.join(target, ".gitignore"),
    "node_modules/\ndist/\n",
  );
  console.log(`✓ 站点已创建: ${target}`);
  console.log("  下一步：将主题放入 themes/ 目录后运行 " + BIN_NAME + " dev");
}
