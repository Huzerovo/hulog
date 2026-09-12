import type { Site } from "./site.js";

/** 模板辅助函数注册表：register 注册，get 读取（主题/插件经 api.helper 使用） */
export interface HelperRegistry {
  register(name: string, fn: Function): void;
  get(name: string): Function | undefined;
  get site(): Site;
}

