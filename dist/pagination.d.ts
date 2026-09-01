import type { Page } from "./types/page.js";
import type { PaginateOptions } from "./types/pagination.js";
/**
 * 分页工具（design-doc §4 generate：虚拟页面分页）。
 * pageUrl / paginate / pinSort 以核心 helper 形式注册（见 helpers.ts），
 * 插件与主题经 api.plugins.helper.get(...) 使用。
 */
/** 计算分页 URL：第 1 页返回 base，其余 base + format + N + "/" */
export declare function pageUrl(base: string, format: string, n: number): string;
/** 将文章切片生成分页虚拟页面 */
export declare function paginate(posts: Page[], opts: PaginateOptions): Page[];
/** 置顶排序：front-matter pin 为真的文章优先（其余保持原顺序） */
export declare function pinSort(posts: Page[]): Page[];
