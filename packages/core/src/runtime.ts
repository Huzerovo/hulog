/**
 * 内部运行时：helper 注册表。
 * 每次 build() 创建独立实例（createHelperRegistry），避免 dev 热重建 / 多次构建 / 测试间状态泄漏。
 * 主题 bundle 时经虚拟模块 "hulog:helpers" 引用，运行时经 "hulog:runtime"（外部，共享同一模块实例）读取当前注册表。
 */

export class HelperRegistry {
  private helpers = new Map<string, Function>();
  private assetsPrefix = "/assets";

  /** 注册模板辅助函数 */
  register(name: string, fn: Function): void {
    this.helpers.set(name, fn);
  }

  /** 获取辅助函数 */
  get(name: string): Function | undefined {
    return this.helpers.get(name);
  }

  /** 全部辅助函数（name → fn） */
  getHelpers(): Record<string, Function> {
    return Object.fromEntries(this.helpers);
  }

  /** 主题资源输出前缀（merge → /assets；namespace → /assets/<theme>） */
  setThemeAssetsPrefix(prefix: string): void {
    this.assetsPrefix = prefix;
  }

  get themeAssetsPrefix(): string {
    return this.assetsPrefix;
  }
}

/** 当前构建使用的注册表（主题 bundle 渲染时经 hulog:runtime 读取） */
let currentRegistry = new HelperRegistry();

/** 创建独立注册表（每次 build 调用一次） */
export function createHelperRegistry(): HelperRegistry {
  return new HelperRegistry();
}

/** 将指定注册表设为当前（build 生命周期内有效） */
export function setCurrentHelpers(registry: HelperRegistry): void {
  currentRegistry = registry;
}

/** 获取当前注册表 */
export function getCurrentHelpers(): HelperRegistry {
  return currentRegistry;
}

/** 兼容旧 API：注册到当前注册表 */
export function __registerHelper(name: string, fn: Function): void {
  currentRegistry.register(name, fn);
}

/** 兼容旧 API：当前注册表的全部辅助函数 */
export function __getHelpers(): Record<string, Function> {
  return currentRegistry.getHelpers();
}
