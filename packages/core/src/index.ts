// TODO
// 检查 export 的必要性，将不需要 export 的剔除
// 需要 export 的有：
// 1. plugins 相关：
//   - helper 提供访问 posts 以及 page 相关资源的能力
//   - generator 提供虚拟页面生成的能力
//   - hook 修改更底层数据的能力
//   - render 提供修改 page 渲染结果的能力
// 2. theme 相关
// 3. config 相关，这个似乎不是很有必要？
// 5. 其他，待分析
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
export { build, type BuildOptions, type BuildResult } from "./build.js";
export {
  parseCategories,
  categoryPathToString,
  categoryPathToUrl,
  buildCategoryTree,
} from "./category.js";
export { loadSiteConfig } from "./config.js";
export { loadTheme, renderPage, resolveThemeDir } from "./theme.js";
export { renderMarkdown } from "./markdown.js";
export { AsyncHookImpl, initHooks } from "./hook.js";
export { SiteImpl, CollectionImpl } from "./site.js";
export { RendererRegistryImpl } from "./renderer.js";
export { GeneratorRegistryImpl } from "./generator.js";
export {
  HelperRegistryImpl,
  registerCoreHelpers,
} from "./helper.js";
export {
  initCorePlugins,
  registerCoreGenerators,
  loadThemePlugins,
  loadSitePlugins,
  type PluginAPI,
  type PluginKind,
  type GeneratorAPI,
  type HookAPI,
  type RendererAPI,
  type ThemeAPI,
} from "./plugins.js";
export {
  scanAssets,
  resolveAssetRef,
  type AssetScanResult,
} from "./assets.js";
