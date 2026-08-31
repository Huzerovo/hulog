import type { HelperRegistry } from "./types/helper.js";
/**
 * 核心内置 helper 注册（每次构建独立注册表）。
 * 插件与主题经 api.plugins.helper.get(...) 使用。
 */
export declare class HelperRegistryImpl implements HelperRegistry {
    private helpers;
    private assetsPrefix;
    /** 注册模板辅助函数 */
    register(name: string, fn: Function): void;
    /** 获取辅助函数 */
    get(name: string): Function | undefined;
    /** 主题资源输出前缀（merge → /assets；namespace → /assets/<theme>） */
    setThemeAssetsPrefix(prefix: string): void;
    get themeAssetsPrefix(): string;
}
export declare function registerCoreHelpers(registry: HelperRegistry): void;
