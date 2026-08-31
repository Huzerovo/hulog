/**
 * 插件系统
 * 插件按文件前缀分为 generator / hook / renderer 三类，在可配置目录（默认 plugins/）中自动发现。
 * 每个插件文件默认导出 `(api) => void | Promise<void>`，api 为统一 PluginAPI（含 plugins 命名空间）。
 * 主题入口同样以 `(api) => Theme` 函数形式接收统一 api。
 * 钩子采用 tapable 风格：同步/异步顺序执行。
 *
 * 从插件目录自动发现并加载插件：
 * - generator-*.ts / hook-*.ts / renderer-*.ts 按前缀注入统一 api（含 plugins 命名空间）
 * - 无前缀文件（如共享工具）忽略并警告
 */
import type { Site } from "./types/site.js";
import type { SiteConfig } from "./types/config.js";
import type { GeneratorRegistry } from "./types/generator.js";
import type { RendererRegistry } from "./types/renderer.js";
import type { HelperRegistry } from "./types/helper.js";
import type { Hooks } from "./types/hook.js";
export type PluginKind = "generator" | "hook" | "renderer" | "helper";
/** 创建统一 api 并注册内置插件（helper / generator），返回可供插件与主题使用的 PluginAPI */
export declare function initCorePlugins(config: SiteConfig, cwd: string): PluginAPI;
/** 内置 generator 注册（initCorePlugins 阶段调用） */
export declare function registerCoreGenerators(api: PluginAPI): void;
/** 主题插件目录加载（build 阶段调用）：themes/<theme>/plugins/ 下的 generator-/hook- 等 */
export declare function loadThemePlugins(api: PluginAPI, cwd: string, themeName: string): Promise<void>;
/** 站点插件目录加载（build 阶段调用）：pluginsDir（默认 plugins/）下的插件 */
export declare function loadSitePlugins(api: PluginAPI, cwd: string): Promise<void>;
export declare function loadPlugins(pluginsDir: string, api: PluginAPI): Promise<void>;
/**
 * 统一插件 api：config / cwd / site 为共享基础，四类能力收敛到 plugins 命名空间。
 */
export interface PluginAPI {
    /** 访问站点配置 */
    config: SiteConfig;
    /** 项目根目录 */
    cwd: string;
    /** 站点对象（afterInit 之后可用） */
    site?: Site;
    /** 注册/使用能力命名空间 */
    plugins: {
        hooks: Hooks;
        generators: GeneratorRegistry;
        renderers: RendererRegistry;
        helpers: HelperRegistry;
    };
}
/** generator 插件 api（plugins/generator-*.ts） */
export type GeneratorAPI = PluginAPI;
/** hook 插件 api（plugins/hook-*.ts） */
export type HookAPI = PluginAPI;
/** renderer 插件 api（plugins/renderer-*.ts） */
export type RendererAPI = PluginAPI;
/** 主题 api（themes/<name>/index.ts 默认导出函数入参） */
export type ThemeAPI = PluginAPI;
