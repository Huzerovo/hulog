import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createJiti } from "jiti";
import less from "less";
import { AsyncHookImpl } from "./hook.js";
import { loadConfig, loadThemeConfig } from "./config.js";
import { SiteImpl, CollectionImpl } from "./site.js";
import { parseFile, type ParseContext } from "./parse.js";
import { renderMarkdown } from "./markdown.js";
import {
  loadTheme,
  renderPage,
  readThemeStyles,
  themeAssetsPrefix,
  type LoadedTheme,
} from "./theme.js";
import { scanAssets, resolveAssetRef } from "./assets.js";
import { __registerHelper, __getHelpers } from "./runtime.js";
import "./helpers.js";
import { __setThemeAssetsPrefix } from "./helpers.js";
import type {
  Asset,
  Collection,
  FileEntry,
  Hooks,
  Page,
  Plugin,
  PluginAPI,
  SiteConfig,
} from "./types/index.js";

/**
 * 构建管线：init → read → parse → filter → generate → process → render → write
 */

export interface BuildOptions {
  cwd?: string;
  /** dev 模式：渲染 draft、不清理 dist（由 dev server 使用） */
  dev?: boolean;
}

export interface BuildResult {
  config: SiteConfig;
  site: SiteImpl;
  pages: { page: Page; html: string }[];
}

/** 内置草稿区配置：dev 下 /draft/:slug/ 预览；不要求 date（发布时才补） */
const DRAFTS_COLLECTION_CONFIG = {
  name: "drafts",
  sourceDir: "drafts",
  routePattern: "/draft/:slug/",
  defaultLayout: "post",
};

export function createHooks(): Hooks {
  return {
    beforeInit: new AsyncHookImpl(),
    afterInit: new AsyncHookImpl(),
    beforeRead: new AsyncHookImpl(),
    afterRead: new AsyncHookImpl(),
    beforeParse: new AsyncHookImpl(),
    afterParse: new AsyncHookImpl(),
    beforeFilter: new AsyncHookImpl(),
    afterFilter: new AsyncHookImpl(),
    beforeGenerate: new AsyncHookImpl(),
    afterGenerate: new AsyncHookImpl(),
    beforeProcess: new AsyncHookImpl(),
    afterProcess: new AsyncHookImpl(),
    beforeRender: new AsyncHookImpl(),
    afterRender: new AsyncHookImpl(),
    beforeWrite: new AsyncHookImpl(),
    afterWrite: new AsyncHookImpl(),
  };
}

export async function build(options: BuildOptions = {}): Promise<BuildResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const config = await loadConfig(cwd);
  const hooks = createHooks();

  // ---- init ----
  await hooks.beforeInit.call(config);
  const site = new SiteImpl();
  await hooks.afterInit.call(site);

  // ---- 插件 ----
  const processHandlers: ((assets: Asset[]) => void | Promise<void>)[] = [];
  const generators: { name: string; fn: (site: any) => Page[] | Promise<Page[]> }[] = [];
  const api: PluginAPI = {
    hooks,
    generator: {
      register(name, fn) {
        generators.push({ name, fn });
      },
    },
    helper: (name, fn) => __registerHelper(name, fn),
    process: (handler) => processHandlers.push(handler),
    addVirtualModule: () => {
      // v1 暂未实现虚拟模块注入，保留 API 占位
    },
    config,
    cwd,
  };
  await loadPlugins(config, cwd, api);
  api.site = site;

  const contentRoot = path.join(cwd, config.content?.rootDir ?? "content");
  const assetsDir = config.assetsDir ?? "assets";
  const assetsDirAbs = path.join(cwd, assetsDir);

  // ---- read ----
  await hooks.beforeRead.call();
  const files: FileEntry[] = scanContent(contentRoot, cwd);
  await hooks.afterRead.call(files);

  // ---- parse ----
  await hooks.beforeParse.call(files);
  const parseCtx: ParseContext = { config, contentRoot, projectRoot: cwd };
  const mdFiles = files.filter((f) => !f.isAsset);
  const pageById = new Map<string, Page>();
  for (const f of mdFiles) {
    const rel = path.relative(contentRoot, f.absolutePath).replace(/\\/g, "/");
    const collectionName = rel.split("/")[0]!;
    let collectionConfig = config.collections.find(
      (c) => c.sourceDir === collectionName,
    );
    if (!collectionConfig) {
      // 内置草稿区：强制 draft，dev 预览
      if (rel.startsWith("drafts/")) {
        collectionConfig = DRAFTS_COLLECTION_CONFIG;
      } else {
        throw new Error(`目录 "${collectionName}" 未配置集合（config.collections 中缺少 sourceDir: "${collectionName}"）`);
      }
    }
    const page = parseFile(f.absolutePath, rel, collectionConfig.name, collectionConfig, parseCtx);
    pageById.set(page.id, page);
  }
  const collections: Collection[] = buildCollections(config, pageById);
  await hooks.afterParse.call(collections);
  for (const col of collections) site.collections.set(col.name, col);

  // ---- filter ----
  await hooks.beforeFilter.call(collections);
  if (!options.dev) {
    for (const col of collections) {
      col.pages = col.pages.filter((p) => !p.draft);
    }
  }
  await hooks.afterFilter.call(collections);

  // ---- generate ----
  const allPages = [...site.pages];
  await hooks.beforeGenerate.call(allPages);
  for (const g of generators) {
    const virtuals = await g.fn(site);
    for (const v of virtuals) {
      allPages.push(v);
      // 挂载虚拟页面到对应集合（或 virtual 集合）
      const col = site.collections.get(v.collection);
      if (col) col.pages.push(v);
    }
  }
  checkUrlConflicts(allPages);
  await hooks.afterGenerate.call(allPages);

  // ---- process ----
  const scanned = scanAssets({ contentRoot, assetsDirAbs, pages: allPages });
  site["_assets"] = scanned.assets as Asset[];
  // 主题资源
  const loadedTheme = await loadTheme(config.theme, cwd);
  __setThemeAssetsPrefix(themeAssetsPrefix(config.theme, loadedTheme.theme.assetsMode));
  // 主题配置合并：主题默认 < 站点 theme.config.ts < blog.config.ts 内联 themeConfig
  const themeConfig = await loadThemeConfig(cwd);
  const mergedThemeConfig: Record<string, unknown> = {
    ...(loadedTheme.theme.config ?? {}),
    ...(themeConfig ?? {}),
    ...(config.themeConfig ?? {}),
  };
  config.themeConfig = mergedThemeConfig;
  if (loadedTheme.assetsDir) {
    const prefix = themeAssetsPrefix(
      config.theme,
      loadedTheme.theme.assetsMode,
    );
    for (const rel of walkFiles(loadedTheme.assetsDir)) {
      const abs = path.join(loadedTheme.assetsDir, rel);
      const base = path.basename(rel);
      // less partial（_ 前缀，如 _highlight.less）仅作为 @import 源，不独立输出
      if (/\.less$/i.test(rel)) {
        if (base.startsWith("_")) continue;
        // less → css 编译
        const css = await compileLess(
          fs.readFileSync(abs, "utf8"),
          abs,
        );
        const cssRel = rel.replace(/\.less$/i, ".css");
        site["_assets"].push({
          sourcePath: abs,
          url: prefix + "/" + cssRel.replace(/\\/g, "/"),
          buffer: Buffer.from(css),
          type: "css",
          belongsTo: "global",
        });
      } else {
        site["_assets"].push({
          sourcePath: abs,
          url: prefix + "/" + rel.replace(/\\/g, "/"),
          buffer: fs.readFileSync(abs),
          type: typeFromExt(rel),
          belongsTo: "global",
        });
      }
    }
  }
  const assets = site.assets;
  await hooks.beforeProcess.call(assets);
  for (const handler of processHandlers) {
    await handler(assets);
  }
  await hooks.afterProcess.call(assets);
  if (scanned.stray.length > 0) {
    console.warn(
      `[warn] 以下散落文件未归属任何文章或全局资源，已忽略：\n  ${scanned.stray.join("\n  ")}`,
    );
  }

  // ---- render ----
  const resolveCtx = { assetsDirAbs, assets, postDirByPageId: new Map() };
  const styles = readThemeStyles(loadedTheme);
  const results: { page: Page; html: string }[] = [];
  for (const page of allPages) {
    await hooks.beforeRender.call(page);
    // 解析 cover（§3.2：parse 后按 9.3 规则解析为最终 URL）
    resolveCover(page, resolveCtx);
    const mdResult = await renderMarkdown(page.rawContent, page, {
      config,
      resolve: resolveCtx as any,
    });
    page.content = mdResult.html;
    page.metadata.toc = mdResult.toc;
    await hooks.afterRender.call(page);
    const html = renderPage(loadedTheme, {
      site: site as any,
      page,
      config,
      styles,
    });
    results.push({ page, html });
  }

  // ---- write ----
  const distDir = path.join(cwd, "dist");
  if (!options.dev) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });
  await hooks.beforeWrite.call(
    results.map((r) => r.page),
    assets,
  );
  for (const { page, html } of results) {
    writeUrl(distDir, page.url, html);
  }
  for (const asset of assets) {
    writeUrl(distDir, asset.url, asset.buffer);
  }
  // public/ 直接复制
  const publicDir = path.join(cwd, "public");
  if (fs.existsSync(publicDir)) {
    copyDir(publicDir, distDir);
  }
  await hooks.afterWrite.call();

  void loadedTheme;
  return { config, site, pages: results };
}

// ---------- 内部工具 ----------

async function loadPlugins(config: SiteConfig, cwd: string, api: PluginAPI) {
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  for (const entry of config.plugins ?? []) {
    const resolve = typeof entry === "string" ? entry : entry.resolve;
    const options = typeof entry === "string" ? undefined : entry.options;
    let mod: any;
    if (resolve.startsWith(".") || path.isAbsolute(resolve)) {
      const abs = path.isAbsolute(resolve)
        ? resolve
        : path.resolve(cwd, resolve);
      mod = await jiti.import(abs);
    } else {
      mod = await import(resolve);
    }
    let plugin: Plugin | undefined = mod.default ?? mod;
    if (typeof plugin === "function") {
      plugin = (plugin as any)(options);
    }
    if (!plugin || typeof plugin.apply !== "function") {
      throw new Error(`插件 "${resolve}" 未导出合法 Plugin（需含 apply 方法）`);
    }
    await plugin.apply(api);
  }
}

function scanContent(contentRoot: string, projectRoot: string): FileEntry[] {
  if (!fs.existsSync(contentRoot)) {
    throw new Error(`内容目录不存在: ${contentRoot}`);
  }
  const files: FileEntry[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile()) {
        const isMd = /\.md$/i.test(entry.name);
        files.push({
          path: path.relative(projectRoot, abs).replace(/\\/g, "/"),
          absolutePath: abs,
          isAsset: !isMd,
        });
      }
    }
  };
  walk(contentRoot);
  return files;
}

function buildCollections(
  config: SiteConfig,
  pageById: Map<string, Page>,
): Collection[] {
  const cols = config.collections.map((cfg) => {
    const pages = [...pageById.values()].filter(
      (p) => p.collection === cfg.name,
    );
    return new CollectionImpl(cfg.name, cfg, pages);
  });
  // 内置草稿区集合（production 下被 filter 阶段过滤）
  const draftPages = [...pageById.values()].filter((p) => p.collection === "drafts");
  if (draftPages.length > 0) {
    cols.push(new CollectionImpl("drafts", DRAFTS_COLLECTION_CONFIG, draftPages));
  }
  return cols;
}

function checkUrlConflicts(pages: Page[]) {
  const seen = new Map<string, string>();
  for (const p of pages) {
    const prev = seen.get(p.url);
    if (prev) {
      throw new Error(`URL 冲突: "${p.url}"（${prev} 与 ${p.id}）`);
    }
    seen.set(p.url, p.id);
  }
}

function resolveCover(
  page: Page,
  ctx: { assetsDirAbs: string; assets: Asset[] },
) {
  if (!page.cover) return;
  const resolveOne = (ref: string): string => {
    if (ref.startsWith("/") || /^https?:|^\/\//.test(ref)) return ref;
    const resolved = resolveAssetRef(ref, page, ctx as any);
    if (resolved === null) {
      throw new Error(
        `[${page.id}] cover 引用未命中任何资源: "${ref}"（已在文章专属目录与全局 assetsDir 查找）`,
      );
    }
    return resolved;
  };
  page.cover = Array.isArray(page.cover)
    ? page.cover.map(resolveOne)
    : resolveOne(page.cover);
}

function writeUrl(distDir: string, url: string, content: string | Buffer) {
  const rel = url.replace(/^\/+/, "");
  // 以 "/" 结尾的是页面 URL（写 index.html）；否则是资源文件路径（直接写）
  const out = url.endsWith("/")
    ? path.join(distDir, rel, "index.html")
    : path.join(distDir, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content);
}

function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string, base: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, entry.name);
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, rel);
      else if (entry.isFile()) out.push(rel);
    }
  };
  walk(dir, "");
  return out;
}

function typeFromExt(filename: string): string {
  const ext = path.extname(filename).toLowerCase().replace(".", "");
  const map: Record<string, string> = {
    png: "image", jpg: "image", jpeg: "image", gif: "image",
    webp: "image", svg: "image", avif: "image", ico: "image",
    css: "css", js: "js", mjs: "js",
    woff: "font", woff2: "font", ttf: "font", eot: "font",
  };
  return map[ext] ?? "other";
}

/** less 编译：主题资源中的 .less 编译为 .css */
async function compileLess(source: string, filename: string): Promise<string> {
  const result = await less.render(source, { filename });
  return result.css;
}
