import type {
  GeneratorCallback,
  GeneratorRegistry,
} from "./types/generator.js";

/**
 * 生成器注册表实现。
 * 内置 generator 经 registerCoreGenerators 注册（initPlugins 阶段）；
 * 主题/站点插件经 loadThemePlugins / loadSitePlugins 注册，同名覆盖内置。
 */
export class GeneratorRegistryImpl implements GeneratorRegistry {
  private generators = new Map<string, GeneratorCallback>();

  register(name: string, fn: GeneratorCallback): void {
    this.generators.set(name, fn);
  }

  get(name: string): GeneratorCallback | undefined {
    return this.generators.get(name);
  }

  forEach(callback: (value: GeneratorCallback, name: string) => void): void {
    this.generators.forEach((value, name) => callback(value, name));
  }
}
