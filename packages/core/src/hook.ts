import type { AsyncHook, Hooks } from "./types/hook.js";

/**
 * tapable 风格异步钩子：按注册顺序依次执行（串行 await）。
 */
export class AsyncHookImpl<T extends unknown[]> implements AsyncHook<T> {
  private taps: { name: string; fn: (...args: T) => void | Promise<void>; }[] =
    [];

  tap(name: string, fn: (...args: T) => void | Promise<void>): void {
    this.taps.push({ name, fn });
  }

  async call(...args: T): Promise<void> {
    for (const t of this.taps) {
      await t.fn(...args);
    }
  }
}

export function initHooks(): Hooks {
  return {
    // init
    afterInit: new AsyncHookImpl(),
    // read
    afterRead: new AsyncHookImpl(),
    // parse
    afterParse: new AsyncHookImpl(),
    // filter
    afterFilter: new AsyncHookImpl(),
    // collect①（物理）
    afterCollectPhysical: new AsyncHookImpl(),
    // generate
    afterGenerate: new AsyncHookImpl(),
    // merge
    afterMerge: new AsyncHookImpl(),
    // collect②（虚拟）
    afterCollectVirtual: new AsyncHookImpl(),
    // process
    afterProcess: new AsyncHookImpl(),
    // render
    beforeRender: new AsyncHookImpl(),
    afterRender: new AsyncHookImpl(),
    // write
    beforeWrite: new AsyncHookImpl(),
    afterWrite: new AsyncHookImpl(),
  };
}

