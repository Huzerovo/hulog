import { Logger } from "@hulog/core";

/**
 * 统一命令执行包装：捕获异常 → logger.error（无堆栈）+ exit 1。
 */
export async function run(
  name: string,
  fn: () => void | Promise<void>,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Logger.getLogger(`cli:${name}`).error(msg);
    process.exit(1);
  }
}
