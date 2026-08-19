import fs from "node:fs";
import path from "node:path";
import type { Asset, Page } from "./types/index.js";
import { toPosixPath } from "./path.js";

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
export function isExternalRef(ref: string): boolean {
  return (
    /^https?:\/\//i.test(ref) ||
    ref.startsWith("//") ||
    ref.startsWith("#") ||
    ref.startsWith("?") ||
    ref.startsWith("data:")
  );
}

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
export function resolveAssetRef(
  ref: string,
  page: Page,
  ctx: ResolveContext,
): string | null {
  if (isExternalRef(ref)) return ref;

  // 绝对路径：/assets/xxx（URL 前缀 → assetsDir 下对应文件）
  if (ref.startsWith("/assets/")) {
    const rel = ref.replace(/^\/assets\//, "");
    const abs = path.join(ctx.assetsDirAbs, rel);
    if (fs.existsSync(abs)) return ref;
    return null;
  }

  // 其他以 / 开头的绝对路径（如部署根相对引用）原样保留
  if (ref.startsWith("/")) return ref;

  // 相对路径：先专属目录（目录映射在 scanAssets 阶段预扫描，避免逐次 stat）
  const postDir = ctx.postDirByPageId.get(page.id);
  if (postDir) {
    const abs = path.resolve(postDir, ref);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      // 专属资源输出与页面同目录，相对引用保持原样即可
      return ref;
    }
  }

  // 再全局 assetsDir
  const absGlobal = path.resolve(ctx.assetsDirAbs, ref);
  if (fs.existsSync(absGlobal) && fs.statSync(absGlobal).isFile()) {
    return "/assets/" + toPosixPath(ref);
  }

  return null;
}

/**
 * 扫描并归类资源：
 * - 文章专属目录内的文件 → 专属 Asset（url = 页面 url + 相对路径）
 * - assetsDir 内文件 → 全局 Asset（url = /assets/xxx）
 * - 其他散落文件 → 警告列表
 */
export function scanAssets(opts: {
  contentRoot: string;
  assetsDirAbs: string;
  pages: Page[];
}): AssetScanResult {
  const { contentRoot, assetsDirAbs, pages } = opts;
  const assets: Asset[] = [];
  const stray: string[] = [];

  // 文章专属目录：页面源文件同名目录
  const postDirs = new Map<string, { dir: string; page: Page }>();
  const postDirByPageId = new Map<string, string>();
  for (const page of pages) {
    if (!page.sourcePath) continue;
    const base = path.basename(page.sourcePath).replace(/\.md$/i, "");
    const dir = path.join(path.dirname(page.sourcePath), base);
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      postDirs.set(path.resolve(dir), { dir, page });
      postDirByPageId.set(page.id, path.resolve(dir));
    }
  }

  // 遍历 content 根目录（不含 assetsDir，assetsDir 单独处理）
  const walk = (dir: string, relBase: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(abs, rel);
      } else if (entry.isFile() && !/\.md$/i.test(entry.name)) {
        // 检查是否属于某文章的专属目录
        const resolvedAbs = path.resolve(abs);
        let owned = false;
        for (const [postDir, info] of postDirs) {
          if (resolvedAbs.startsWith(postDir + path.sep)) {
            const relInDir = toPosixPath(path.relative(info.dir, abs));
            assets.push({
              sourcePath: abs,
              url: info.page.url + relInDir,
              buffer: fs.readFileSync(abs),
              type: assetType(entry.name),
              belongsTo: info.page.id,
            });
            owned = true;
            break;
          }
        }
        if (!owned) stray.push(rel);
      }
    }
  };
  walk(contentRoot, "");

  // 全局资源：assetsDir
  if (fs.existsSync(assetsDirAbs)) {
    assets.push(...scanDirectoryAssets(assetsDirAbs, "/assets"));
  }

  return { assets, stray, postDirByPageId };
}

/** 扫描目录内全部文件为全局 Asset（url = urlPrefix + 相对路径） */
export function scanDirectoryAssets(dir: string, urlPrefix: string): Asset[] {
  const out: Asset[] = [];
  const walk = (d: string, relBase: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, entry.name);
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(abs, rel);
      } else if (entry.isFile()) {
        out.push({
          sourcePath: abs,
          url: urlPrefix + "/" + toPosixPath(rel),
          buffer: fs.readFileSync(abs),
          type: assetType(entry.name),
          belongsTo: "global",
        });
      }
    }
  };
  walk(dir, "");
  return out;
}

/** 按扩展名推断资源类型 */
export function assetType(filename: string): string {
  const ext = path.extname(filename).toLowerCase().replace(".", "");
  const map: Record<string, string> = {
    png: "image",
    jpg: "image",
    jpeg: "image",
    gif: "image",
    webp: "image",
    svg: "image",
    avif: "image",
    ico: "image",
    css: "css",
    js: "js",
    mjs: "js",
    woff: "font",
    woff2: "font",
    ttf: "font",
    eot: "font",
  };
  return map[ext] ?? "other";
}
