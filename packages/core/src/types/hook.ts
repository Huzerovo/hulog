import { Asset } from "./asset.js";
import { Collection } from "./collection.js";
import { SiteConfig } from "./config.js";
import { Page } from "./page.js";
import { FileEntry } from "./sequence.js";
import { Site } from "./site.js";

/** tapable 风格异步钩子 */
export interface AsyncHook<T extends unknown[]> {
  /** 注册监听函数（按注册顺序执行） */
  tap(name: string, fn: (...args: T) => void | Promise<void>): void;
  /** 触发全部监听函数 */
  call(...args: T): Promise<void>;
}

/** 全部构建阶段钩子 */
export interface Hooks {
  beforeInit: AsyncHook<[SiteConfig]>; // 修改配置
  afterInit: AsyncHook<[Site]>;
  beforeRead: AsyncHook<[]>;
  afterRead: AsyncHook<[FileEntry[]]>;
  beforeParse: AsyncHook<[FileEntry[]]>;
  afterParse: AsyncHook<[Collection[]]>; // 集合视角；全局数组视角在 afterFilter 后经 site.pages 获取
  beforeFilter: AsyncHook<[Collection[]]>;
  afterFilter: AsyncHook<[Collection[]]>;
  beforeGenerate: AsyncHook<[Page[]]>;
  afterGenerate: AsyncHook<[Page[]]>;
  beforeProcess: AsyncHook<[Asset[]]>;
  afterProcess: AsyncHook<[Asset[]]>;
  beforeRender: AsyncHook<[Page]>; // 渲染前拦截（不可替换 render，仅可修改 page/准备）
  afterRender: AsyncHook<[Page]>; // 渲染后可修改 page.content / metadata
  beforeWrite: AsyncHook<[Page[], Asset[]]>;
  afterWrite: AsyncHook<[]>;
}

