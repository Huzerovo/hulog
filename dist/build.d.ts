import { SiteImpl } from "./site.js";
import type { Page } from "./types/page.js";
import type { SiteConfig } from "./types/config.js";
export interface BuildOptions {
    cwd?: string;
    /** dev 模式：渲染 draft、不清理 dist（由 dev server 使用） */
    dev?: boolean;
}
export interface BuildResult {
    config: SiteConfig;
    site: SiteImpl;
    pages: {
        page: Page;
        html: string;
    }[];
}
export declare function build(options?: BuildOptions): Promise<BuildResult>;
