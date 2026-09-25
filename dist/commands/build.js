import { build, Logger } from "@hulog/core";
export async function buildCmd(opts) {
    const logger = Logger.getLogger("cli:build");
    const start = Date.now();
    const result = await build({ cwd: opts.base || process.cwd() });
    const ms = Date.now() - start;
    logger.info(`构建完成: ${result.pages.length} 个页面, ${result.site.assets.length} 个资源 (${ms}ms)`);
}
//# sourceMappingURL=build.js.map