import type { Page } from "./page.js";
import type { Site } from "./site.js";

/** 生成器回调：输入站点（含已 collect 的物理集合），输出虚拟页面（可异步） */
export type GeneratorCallback = (site: Site) => Page[] | Promise<Page[]>;

/** 生成器注册表：产生虚拟页面（无源文件），同名 register 覆盖 */
export interface GeneratorRegistry {
  register(name: string, fn: GeneratorCallback): void;

  get(name: string): GeneratorCallback | undefined;

  forEach(callback: (value: GeneratorCallback, name: string) => void): void;
}
