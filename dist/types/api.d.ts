import type { SiteConfig } from "./config.js";
import type { Site } from "./site.js";
import type { Theme } from "./theme.js";
import type { GeneratorRegistry } from "./generator.js";
import type { HelperRegistry } from "./helper.js";
import type { Hooks } from "./hook.js";
import type { RendererRegistry } from "./renderer.js";
/**
 * 插件系统 API 分层：
 * - RuntimeContext：所有插件共享的只读上下文（config / cwd）
 * - GeneratorAPI / HookAPI / RendererAPI / HelperAPI：按文件前缀注入的**作用域化** API
 * - Registries：构建管线内部使用的全部注册表
 * - CoreAPI：主题布局使用的只读 API（site / theme / helper）
 */
/** 插件共享的只读上下文 */
export interface RuntimeContext {
    /** 站点配置 */
    config: SiteConfig;
    /** 项目根目录 */
    cwd: string;
}
/** generator 插件 API（generator-*.ts）：注册生成器 + 使用 helper */
export interface GeneratorAPI extends RuntimeContext {
    generator: GeneratorRegistry;
    helper: HelperRegistry;
}
/** hook 插件 API（hook-*.ts）：注册/触发 hooks */
export interface HookAPI extends RuntimeContext {
    hook: Hooks;
}
/** renderer 插件 API（renderer-*.ts）：注册 renderer */
export interface RendererAPI extends RuntimeContext {
    renderer: RendererRegistry;
}
/** helper 插件 API（helper-*.ts）：注册 helper */
export interface HelperAPI extends RuntimeContext {
    helper: HelperRegistry;
}
/** 构建管线内部编排使用的全部注册表 */
export interface Registries {
    generators: GeneratorRegistry;
    helpers: HelperRegistry;
    hooks: Hooks;
    renderers: RendererRegistry;
}
/**
 * CoreAPI —— 主题布局使用的只读 API。
 * 经 api.site（含 .config 站点配置 / .posts / .pages）与 api.theme（含 .config 主题配置）读取数据，
 * 经 api.helper 使用模板辅助函数。**不暴露** generators / hooks / renderers。
 */
export interface CoreAPI {
    /** 项目根目录 */
    root: string;
    /** 站点对象（配置 + 页面集合） */
    site: Site;
    /** 主题对象（含合并后的主题配置） */
    theme: Theme;
    /** 模板辅助函数注册表（只读 get） */
    helper: HelperRegistry;
}
