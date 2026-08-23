/**
 * @hulog/core —— 静态博客生成器核心
 *
 * 用法：
 * ```ts
 * import { build } from "@hulog/core";
 * await build({ cwd: process.cwd() });
 * ```
 */
export * from "./types/index.js";
export { BIN_NAME } from "./constants.js";
export { build, createHooks, type BuildOptions, type BuildResult } from "./build.js";
export {
  parseCategories,
  categoryPathToString,
  categoryPathToUrl,
  buildCategoryTree,
} from "./category.js";
export { loadSiteConfig } from "./config.js";
export { loadTheme, renderPage, resolveThemeDir } from "./theme.js";
export { renderMarkdown } from "./markdown.js";
export { AsyncHookImpl } from "./hook.js";
export { SiteImpl, CollectionImpl } from "./site.js";
export { RendererRegistryImpl } from "./renderer.js";
export {
  scanAssets,
  resolveAssetRef,
  type AssetScanResult,
} from "./assets.js";
