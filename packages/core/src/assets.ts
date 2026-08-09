import fs from "node:fs";
import path from "node:path";
import type { Asset, Page, SiteConfig } from "./types/index.js";

/**
 * 资源收集与引用解析
 */

export interface AssetScanResult {
  assets: Asset[];
  /** 散落文件（既不在专属目录也不在 assetsDir），警告用 */
  stray: string[];
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
 * 解析文章专属目录（content/posts/my-post.md → content/posts/my-post/）
 */
export function postAssetDir(page: Page): string | null {
  if (!page.sourcePath) return null;
  const base = path.basename(page.sourcePath).replace(/\.md$/i, "");
  const dir = path.dirname(page.sourcePath);
  const candidate = path.join(dir, base);
  return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()
    ? candidate
    : null;
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

  // 绝对路径：/assets/xxx
  if (ref.startsWith("/")) {
    const rel = ref.replace(/^\/+/, "");
    const abs = path.join(ctx.assetsDirAbs, rel);
    if (fs.existsSync(abs)) return ref;
    return null;
  }

  // 相对路径：先专属目录
  const postDir = postAssetDir(page);
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
    return "/assets/" + ref.replace(/\\/g, "/");
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
  for (const page of pages) {
    if (!page.sourcePath) continue;
    const base = path.basename(page.sourcePath).replace(/\.md$/i, "");
    const dir = path.join(path.dirname(page.sourcePath), base);
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      postDirs.set(path.resolve(dir), { dir, page });
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
            const relInDir = path.relative(info.dir, abs).replace(/\\/g, "/");
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
    const walkGlobal = (dir: string, relBase: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walkGlobal(abs, rel);
        } else if (entry.isFile()) {
          assets.push({
            sourcePath: abs,
            url: "/assets/" + rel.replace(/\\/g, "/"),
            buffer: fs.readFileSync(abs),
            type: assetType(entry.name),
            belongsTo: "global",
          });
        }
      }
    };
    walkGlobal(assetsDirAbs, "");
  }

  return { assets, stray };
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
