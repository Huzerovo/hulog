import type { Asset } from "./types/asset.js";
import type { Page } from "./types/page.js";
/**
 * 资源收集与引用解析
 */
export interface AssetScanResult {
    assets: Asset[];
    /** 散落文件（既不在专属目录也不在 assetsDir），警告用 */
    stray: string[];
    /** 页面 id → 文章专属目录绝对路径（resolveAssetRef 复用，避免逐次磁盘探测） */
    postDirByPageId: Map<string, string>;
}
/** 是否为外部/绝对 URL（原样保留） */
export declare function isExternalRef(ref: string): boolean;
export interface ResolveContext {
    /** 站点 assetsDir 绝对路径 */
    assetsDirAbs: string;
    /** 全部 Asset（含专属与全局） */
    assets: Asset[];
    /** 页面 id → 专属目录绝对路径 */
    postDirByPageId: Map<string, string>;
}
/**
 * 解析资源引用：
 * - 外部/锚点/查询串 → 原样
 * - /assets/ 绝对路径 → 校验全局资源存在，原样返回
 * - 相对路径 → 先在文章专属目录查找（命中输出相对引用，结构对齐无需重写）
 *   → 再在全局 assetsDir 查找（命中重写为 /assets/xxx）
 * - 未命中返回 null（调用方报错）
 */
export declare function resolveAssetRef(ref: string, page: Page, ctx: ResolveContext): string | null;
/**
 * 扫描并归类资源：
 * - 文章专属目录内的文件 → 专属 Asset（url = 页面 url + 相对路径）
 * - assetsDir 内文件 → 全局 Asset（url = /assets/xxx）
 * - 其他散落文件 → 警告列表
 */
export declare function scanAssets(opts: {
    contentRoot: string;
    assetsDirAbs: string;
    pages: Page[];
}): AssetScanResult;
/** 扫描目录内全部文件为全局 Asset（url = urlPrefix + 相对路径） */
export declare function scanDirectoryAssets(dir: string, urlPrefix: string): Asset[];
/** 按扩展名推断资源类型 */
export declare function assetType(filename: string): string;
