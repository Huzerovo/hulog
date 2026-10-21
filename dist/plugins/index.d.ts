/**
 * 插件系统：按文件前缀自动发现并加载插件，向每类插件注入**作用域化** API。
 *
 * - generator-*.ts → GeneratorAPI（generator + helper）
 * - hook-*.ts      → HookAPI（hook）
 * - renderer-*.ts  → RendererAPI（renderer）
 * - helper-*.ts    → HelperAPI（helper）
 *
 * 无前缀文件（共享工具）忽略并警告。
 */
import type { Site } from "../types/site.js";
import type { GeneratorAPI, HelperAPI, HookAPI, Registries, RendererAPI } from "../types/api.js";
export type PluginKind = "generator" | "hook" | "renderer" | "helper";
/** 四类插件的 scoped API 集合（加载时按前缀取用） */
export interface ScopedAPIs {
    generator: GeneratorAPI;
    hook: HookAPI;
    renderer: RendererAPI;
    helper: HelperAPI;
}
/**
 * 创建注册表并组装 scoped 插件 API。site 需已创建（helpers 绑定 site）。
 * 内置 generator 以 GeneratorAPI 注册。
 */
export declare function initCorePlugins(site: Site, cwd: string): Promise<{
    registries: Registries;
    scoped: ScopedAPIs;
}>;
/** 内置 generator 注册（initCorePlugins 阶段调用） */
export declare function registerCoreGenerators(api: GeneratorAPI): void;
/** 主题插件目录加载（build 阶段调用）：themes/<theme>/plugins/ 下的 generator-/hook- 等 */
export declare function loadThemePlugins(scoped: ScopedAPIs, cwd: string, themeName: string): Promise<void>;
/** 站点插件目录加载（build 阶段调用）：pluginsDir（默认 plugins/）下的插件 */
export declare function loadSitePlugins(scoped: ScopedAPIs, cwd: string, site: Site): Promise<void>;
export declare function loadPlugins(pluginsDir: string, scoped: ScopedAPIs): Promise<void>;
