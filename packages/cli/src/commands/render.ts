import path from "node:path";
import { Logger, renderMarkdownFile } from "@hulog/core";

export interface RenderCommandOptions {
  /** 输入 markdown 文件 */
  file: string;
  /** 输出 html 路径 */
  out?: string;
  /** 主题名或路径（缺省取站点配置） */
  theme?: string;
  /** 站点根目录 */
  base?: string;
  /** 布局名 */
  layout?: string;
  /** 覆盖标题 */
  title?: string;
}

/** hulog render：将单个 Markdown 渲染为自包含 HTML（复用站点主题） */
export async function renderCmd(opts: RenderCommandOptions) {
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
