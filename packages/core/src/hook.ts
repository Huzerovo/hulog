import type { AsyncHook } from "./types/index.js";

/**
 * tapable 风格异步钩子：按注册顺序依次执行（串行 await）。
 */
export class AsyncHookImpl<T extends unknown[]> implements AsyncHook<T> {
  private taps: { name: string; fn: (...args: T) => void | Promise<void> }[] =
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
