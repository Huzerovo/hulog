import type { GeneratorCallback, GeneratorRegistry } from "./types/generator.js";
/**
 * 生成器注册表实现。
 * 内置 generator 经 registerCoreGenerators 注册（initPlugins 阶段）；
 * 主题/站点插件经 loadThemePlugins / loadSitePlugins 注册，同名覆盖内置。
 */
export declare class GeneratorRegistryImpl implements GeneratorRegistry {
    private generators;
    register(name: string, fn: GeneratorCallback): void;
    get(name: string): GeneratorCallback | undefined;
    forEach(callback: (value: GeneratorCallback, name: string) => void): void;
}
