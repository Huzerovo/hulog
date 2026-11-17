import path from "node:path";
import { Logger, renderMarkdownFile } from "@hulog/core";
/** hulog render：将单个 Markdown 渲染为自包含 HTML（复用站点主题） */
export async function renderCmd(opts) {
    const logger = Logger.getLogger("cli:render");
    const result = await renderMarkdownFile({
        file: opts.file,
        outFile: opts.out,
        theme: opts.theme,
        root: opts.base,
        layout: opts.layout,
        title: opts.title,
    });
    const rel = path.relative(process.cwd(), result.outFile);
    logger.info(`输出: ${rel.startsWith("..") ? result.outFile : rel}`);
}
//# sourceMappingURL=render.js.map