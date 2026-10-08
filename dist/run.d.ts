/**
 * 统一命令执行包装：捕获异常 → logger.error（无堆栈）+ exit 1。
 */
export declare function run(name: string, fn: () => void | Promise<void>): Promise<void>;
