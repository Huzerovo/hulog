/**
 * NOTE 分类可以是高维数组，在 yaml 中表示为：
 * - A
 *   - B1
 *     - C
 *   - B2
 */
export type CategoryPath = string[];
export declare const VIRTUAL_PAGE_COLLECTION = "core:virtual";
export declare const RESERVED_KEYS: Set<string>;
/**
 * 分类树节点（分类页/树形展示用）。
 * count 为该分类直接或间接（含后代子分类）包含的文章数。
 */
export interface CategoryNode {
    /** 节点名（单层，如 "子分类"） */
    name: string;
    /** 完整路径（从根到本节点） */
    path: CategoryPath;
    /** 直接或通过子分类包含的文章数 */
    count: number;
    /** 子分类 */
    children: CategoryNode[];
}
export interface PageBase {
    id: string;
    url: string;
    title: string;
    layout: string;
}
export interface PagePostOptional {
    date: Date;
    updated: Date;
    draft?: boolean;
    tags?: string[];
    categories?: CategoryPath[];
    link?: string;
    cover?: string | string[];
    excerpt?: string;
}
export interface PageOptional {
    collection: string;
    sourcePath: string | null;
    aliases: string[];
    slug: string;
    rawContent: string;
    content: string;
    data: Record<string, unknown>;
    metadata: Record<string, unknown>;
}
/**
 * Page —— 核心数据抽象
 * 每个源文件经解析后生成统一的 Page 对象，供模板和插件使用。
 * 所有构建选项均被赋值为非 undefine 默认值
 */
export type Page = PageBase & Partial<PagePostOptional> & PageOptional;
export type Post = Pick<PageBase, "title"> & PagePostOptional;
