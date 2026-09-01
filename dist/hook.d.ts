import type { AsyncHook, Hooks } from "./types/hook.js";
/**
 * tapable 风格异步钩子：按注册顺序依次执行（串行 await）。
 */
export declare class AsyncHookImpl<T extends unknown[]> implements AsyncHook<T> {
    private taps;
    tap(name: string, fn: (...args: T) => void | Promise<void>): void;
    call(...args: T): Promise<void>;
}
export declare function initHooks(): Hooks;
