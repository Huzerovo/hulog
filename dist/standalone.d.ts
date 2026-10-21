/**
 * 单文件渲染：输入一个纯 Markdown 文件（可无 front-matter），
 * 用站点主题渲染为**自包含 HTML**（主题 CSS/JS 内联、正文图片转 data URI）。
 *
 * 约定：
 * - 标题：options.title → 正文首个 H1（并从正文移除）→ 文件名；
 * - 页面放在合成集合 "posts" 中，布局默认 "post"；
 * - 主题与主题配置：优先读取 root 的 blog.config.* / theme.config.*，无配置时用 options.theme；
 * - 单页模式：不生成 search.json、归档/标签/图册等站点级页面；
 * - KaTeX/Mermaid 的 CDN 资源保持外链（单文件下仍需联网）。
 */
export interface RenderMarkdownFileOptions {
    /** 输入 Markdown 文件路径 */
    file: string;
    /** 站点根目录（定位 themes/、blog.config.*、theme.config.*），默认 process.cwd() */
    root?: string;
    /** 主题名或路径；缺省读取站点配置的 theme */
    theme?: string;
    /** 布局名，默认 "post" */
    layout?: string;
    /** 覆盖标题（提供时正文 H1 不删除） */
    title?: string;
    /** 覆盖日期（默认取文件 mtime） */
    date?: Date | string;
    /** 输出 HTML 路径，默认与输入同名的 .html */
    outFile?: string;
}
export interface RenderMarkdownFileResult {
    /** 输出文件绝对路径 */
    outFile: string;
    /** 生成的完整 HTML */
    html: string;
}
/**
 * 单文件 markdown 渲染：合成 Page/Site，复用 markdown 管线与主题布局，
 * 最后把主题资源与图片内联，写出单个自包含 HTML。
 */
export declare function renderMarkdownFile(options: RenderMarkdownFileOptions): Promise<RenderMarkdownFileResult>;
