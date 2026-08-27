/**
 * 内部运行时：helper 注册表。
 * 每次 build() 创建独立实例（createHelperRegistry），避免 dev 热重建 / 多次构建 / 测试间状态泄漏。
 * 经统一 api.plugins.helper 暴露给插件与主题（register 注册 / get 读取）。
 */

// import { HelperRegistryImpl } from "./types/helper.js";
// import { HelperRegistry } from "./types/plugins";

// export class HelperRegistry {
//   private helpers = new Map<string, Function>();
//   private assetsPrefix = "/assets";

//   [>* 注册模板辅助函数 <]
//   register(name: string, fn: Function): void {
//     this.helpers.set(name, fn);
//   }

//   [>* 获取辅助函数 <]
//   get(name: string): Function | undefined {
//     return this.helpers.get(name);
//   }

//   [>* 主题资源输出前缀（merge → /assets；namespace → /assets/<theme>） <]
//   setThemeAssetsPrefix(prefix: string): void {
//     this.assetsPrefix = prefix;
//   }

//   get themeAssetsPrefix(): string {
//     return this.assetsPrefix;
//   }
// }

/** 创建独立注册表（每次 build 调用一次） */
// export function createHelperRegistry(): HelperRegistry {
//   return new HelperRegistryImpl();
// }
