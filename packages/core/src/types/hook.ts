import type { Asset } from "./asset.js";
import type { Collection } from "./collection.js";
import type { Page } from "./page.js";
import type { FileEntry } from "./sequence.js";
import type { Site } from "./site.js";

/** tapable 风格异步钩子 */
export interface AsyncHook<T extends unknown[]> {
  /** 注册监听函数（按注册顺序执行） */
  tap(name: string, fn: (...args: T) => void | Promise<void>): void;
  /** 触发全部监听函数 */
  call(...args: T): Promise<void>;
}

/** 全部构建阶段钩子 */
export interface Hooks {
  // init
  afterInit: AsyncHook<[Site]>;
  // read
  afterRead: AsyncHook<[FileEntry[]]>;
  // parse
  afterParse: AsyncHook<[Page[]]>; // 集合视角；全局数组视角在 afterFilter 后经 site.pages 获取
  // filter
  afterFilter: AsyncHook<[Page[]]>;
  // generate
  afterGenerate: AsyncHook<[Page[]]>;
  // merge
  afterMerge: AsyncHook<[Page[]]>;
  // collect
  afterCollect: AsyncHook<[Collection[]]>;
  // process
  afterProcess: AsyncHook<[Asset[]]>;
  // render
  beforeRender: AsyncHook<[Page]>; // 渲染前拦截（不可替换 render，仅可修改 page/准备）
  afterRender: AsyncHook<[Page]>; // 渲染后可修改 page.content / metadata
  // write
  beforeWrite: AsyncHook<[Page[], Asset[]]>;
  afterWrite: AsyncHook<[]>;
}

