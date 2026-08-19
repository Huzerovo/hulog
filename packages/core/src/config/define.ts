import type { DefineConfigInput, SiteConfig } from "../types/index.js";

/**
 * defineConfig —— 配置入口
 * 支持对象或函数形式；函数接收默认配置，返回最终配置。
 */
export function defineConfig(config: DefineConfigInput): SiteConfig {
  const defaults: Partial<SiteConfig> = {
    assetsDir: "assets",
    content: { rootDir: "content" },
    markdown: { highlight: true, katex: true, clientHighlight: false },
    server: { port: 3000, hot: true },
    cli: { newPostDraft: true },
    pluginsDir: "plugins",
    language: "zh-CN",
    perPage: 10,
    archiveDir: "archive",
    paginationDir: "page",
  };
  if (typeof config === "function") {
    return { ...defaults, ...config(defaults) };
  }
  return { ...defaults, ...config };
}
