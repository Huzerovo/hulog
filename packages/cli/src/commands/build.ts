import { build } from "@hulog/core";

export async function buildCmd() {
  const start = Date.now();
  // FIXME
  // 这里应该像 dev 一样提供参数改写 cwd
  const result = await build({ cwd: process.cwd() });
  const ms = Date.now() - start;
  console.log(
    `✓ 构建完成: ${result.pages.length} 个页面, ${result.site.assets.length} 个资源 (${ms}ms)`,
  );
}
