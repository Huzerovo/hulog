import type { CategoryNode, CategoryPath } from "./types/page.js";
/**
 * 解析 front-matter categories 为完整路径列表（去重，保持出现顺序）。
 * 不支持的类型（如纯数字数组之外的奇怪结构）会被忽略。
 */
export declare function parseCategories(value: unknown): CategoryPath[];
/** 路径 → 展示字符串："父/子" */
export declare function categoryPathToString(path: CategoryPath): string;
/**
 * 路径 → 分类页 URL：/categories/<seg1>/<seg2>/（各段 encodeURIComponent，以 / 结尾）。
 * base 可覆盖前缀（默认 "/categories"）。
 */
export declare function categoryPathToUrl(path: CategoryPath, base?: string): string;
/**
 * 由文章分类路径构建分类树（含祖先节点）。
 * 每条路径会为其所有前缀（祖先）建立节点，node.count = 该分类直接或间接包含的文章数。
 * 返回按名称排序的顶层节点；children 同样排序。
 */
export declare function buildCategoryTree(paths: CategoryPath[]): CategoryNode[];
