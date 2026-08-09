/**
 * 内部运行时：helper 注册表（主题 bundle 时经虚拟模块引用）。
 * 不对外导出，仅供 helpers.ts 与主题加载器使用。
 */
const helpers = new Map<string, Function>();

export function __registerHelper(name: string, fn: Function): void {
  helpers.set(name, fn);
}

export function __getHelpers(): Record<string, Function> {
  return Object.fromEntries(helpers);
}
