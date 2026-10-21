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
    afterInit: AsyncHook<[Site]>;
    afterRead: AsyncHook<[FileEntry[]]>;
    afterParse: AsyncHook<[Page[]]>;
    afterFilter: AsyncHook<[Page[]]>;
    afterCollectPhysical: AsyncHook<[Collection[]]>;
    afterGenerate: AsyncHook<[Page[]]>;
    afterMerge: AsyncHook<[Page[]]>;
    afterCollectVirtual: AsyncHook<[Collection[]]>;
    afterProcess: AsyncHook<[Asset[]]>;
    beforeRender: AsyncHook<[Page]>;
    afterRender: AsyncHook<[Page]>;
    beforeWrite: AsyncHook<[Page[], Asset[]]>;
    afterWrite: AsyncHook<[]>;
}
