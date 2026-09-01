import type { Page } from "./page.js";
/** 源文件条目（read 阶段产物） */
export interface FileEntry {
    /** 相对项目根的路径，如 "content/posts/hello.md" */
    path: string;
    /** 绝对路径 */
    absolutePath: string;
    /** 是否为资源文件（非 Markdown） */
    isAsset: boolean;
}
export interface RenderResult {
    page: Page;
    html: string;
}
