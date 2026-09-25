import type { HelperRegistry } from "../types/helper.js";
import type { Site } from "../types/site.js";
/**
 * 核心内置 helper 注册（每次构建独立注册表）。
 * 插件与主题经 api.helper.get(...) 使用。
 */
export declare class HelperRegistryImpl implements HelperRegistry {
    private helpers;
    private _site;
    constructor(site: Site);
    /** 注册模板辅助函数 */
    register(name: string, fn: Function): void;
    /** 获取辅助函数 */
    get(name: string): Function | undefined;
    get site(): Site;
}
export declare function registerCoreHelpers(registry: HelperRegistry): void;
