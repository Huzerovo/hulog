/**
 * 生成器注册表实现。
 * 内置 generator 经 registerCoreGenerators 注册（initPlugins 阶段）；
 * 主题/站点插件经 loadThemePlugins / loadSitePlugins 注册，同名覆盖内置。
 */
export class GeneratorRegistryImpl {
    generators = new Map();
    register(name, fn) {
        this.generators.set(name, fn);
    }
    get(name) {
        return this.generators.get(name);
    }
    forEach(callback) {
        this.generators.forEach((value, name) => callback(value, name));
    }
}
//# sourceMappingURL=generator.js.map