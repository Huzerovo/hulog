import fs from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";
import less from "less";
import { AsyncHookImpl } from "./hook.js";
import { loadSiteConfig, loadThemeConfig } from "./config.js";
import { SiteImpl, CollectionImpl } from "./site.js";
import { parseFile, type ParseContext } from "./parse.js";
import { renderMarkdown } from "./markdown.js";
import {
  loadTheme,
  renderPage,
  readThemeStyles,
  themeAssetsPrefix,
} from "./theme.js";
import {
  scanAssets,
  resolveAssetRef,
  assetType,
  type ResolveContext,
} from "./assets.js";
import {
  createHelperRegistry,
  setCurrentHelpers,
  type HelperRegistry,
} from "./runtime.js";
import { registerCoreHelpers } from "./helpers.js";
import type {
  Asset,
  Collection,
  FileEntry,
  Hooks,
  Page,
  Plugin,
  PluginAPI,
  Site,
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
  pages: { page: Page; html: string; }[];
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
  const buildLog = (msg: string) => console.log("  [build]: " + msg);
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const siteConfig = await loadSiteConfig(cwd);

  const hooks = createHooks();

  // ---- init ----
  await hooks.beforeInit.call(siteConfig);
  const site = new SiteImpl();
  await hooks.afterInit.call(site);

  // ---- 插件 ----
  // 本次构建独立的 helper 注册表：插件经 api.helper 注册，主题经虚拟模块使用。
  // 每次 build 新建，避免 dev 热重建 / 多次构建之间累积与泄漏。
  const helpers: HelperRegistry = createHelperRegistry();
  registerCoreHelpers(helpers);
  setCurrentHelpers(helpers);

  const processHandlers: ((assets: Asset[]) => void | Promise<void>)[] = [];
  const generators: { name: string; fn: (site: Site) => Page[] | Promise<Page[]> }[] = [];
  const api: PluginAPI = {
    hooks,
    generator: {
      register(name, fn) {
        generators.push({ name, fn });
      },
    },
    helper: (name, fn) => helpers.register(name, fn),
    process: (handler) => processHandlers.push(handler),
    config: siteConfig,
    cwd,
  };
  await loadPlugins(siteConfig, cwd, api);

  buildLog("Loaded Plugins");
  api.site = site;

  const contentRoot = path.join(cwd, siteConfig.content?.rootDir ?? "content");
  const assetsDir = siteConfig.assetsDir ?? "assets";
  const assetsDirAbs = path.join(cwd, assetsDir);

  // ---- read ----
  await hooks.beforeRead.call();
  const files: FileEntry[] = scanContent(contentRoot, cwd);
  await hooks.afterRead.call(files);
  buildLog("Finished read");

  // ---- parse ----
  await hooks.beforeParse.call(files);
  const parseCtx: ParseContext = { config: siteConfig, contentRoot, projectRoot: cwd };
  const mdFiles = files.filter((f) => !f.isAsset);
  const pageById = new Map<string, Page>();
  for (const f of mdFiles) {
    // NOTE
    // 似乎是在替换 Windows 风格的路径？但是 Linux 上似乎允许存在 `\` 但是应该也没有人会用这样奇怪的路径名吧？
    const rel = path.relative(contentRoot, f.absolutePath).replace(/\\/g, "/");
    const collectionName = rel.split("/")[0]!;
    let collectionConfig = siteConfig.collections.find(
      (c) => c.sourceDir === collectionName,
    );
    if (!collectionConfig) {
      // 内置草稿区：强制 draft，dev 预览
      // NOTE 考虑草稿区名称设置为可自定义
      if (rel.startsWith("drafts/")) {
        collectionConfig = DRAFTS_COLLECTION_CONFIG;
      } else {
        // NOTE
        // 考虑到 content 下应该允许用户创建自定义的文件夹，这里改为抛出警告会不会更好一些？
        throw new Error(`目录 "${collectionName}" 未配置集合（config.collections 中缺少 sourceDir: "${collectionName}"）`);
      }
    }
    const page = parseFile(f.absolutePath, rel, collectionConfig.name, collectionConfig, parseCtx);
    pageById.set(page.id, page);
  }
  // NOTE
  // 这里的处理是不是比较奇怪？parse 阶段针对的是单个文件对 Page 对象的转换过程。
  // Collection 是针对多个 Page 的，上面的处理过程是根据 Collection 处理 Page，
  // 似乎不太对？应该单独设置一个阶段吗？
  const collections: Collection[] = buildCollections(siteConfig, pageById);
  await hooks.afterParse.call(collections);
  buildLog("Finished parse");
  for (const col of collections) site.collections.set(col.name, col);

  // ---- filter ----
  // NOTE
  // 这里的 filter 似乎也与预期不符合，filter 作用应该是忽略渲染某些 Page 或者处理 Assets
  // 比如忽略压缩某些文件，跳过处理某些文章（但这个好像不是很有意义）
  // 目前需要再考虑这个阶段存在的意义
  await hooks.beforeFilter.call(collections);
  if (!options.dev) {
    for (const col of collections) {
      col.pages = col.pages.filter((p) => !p.draft);
    }
  }
  await hooks.afterFilter.call(collections);
  buildLog("Finished filter");

  // ---- generate ----
  // NOTE site.pages 实际上是 Collections 到 Pages 的一个映射关系，没有实际存储 Page，无需担心同步问题
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
  buildLog("Finished generate");

  // ---- process ----
  const scanned = scanAssets({ contentRoot, assetsDirAbs, pages: allPages });
  site["_assets"] = scanned.assets as Asset[];
  // 主题资源
  const loadedTheme = await loadTheme(siteConfig.theme, cwd, helpers);
  // 主题资源输出前缀（themeAsset helper 与主题资源写入共用）
  const prefix = themeAssetsPrefix(siteConfig.theme, loadedTheme.theme.assetsMode);
  helpers.setThemeAssetsPrefix(prefix);
  // 主题配置合并：主题默认 < 站点 theme.config.ts < blog.config.ts 内联 themeConfig
  const themeConfig = await loadThemeConfig(cwd);
  const mergedThemeConfig: Record<string, unknown> = {
    ...(loadedTheme.theme.defaultConfig ?? {}),
    ...(themeConfig ?? {}),
    ...(siteConfig.themeConfig ?? {}),
  };
  siteConfig.themeConfig = mergedThemeConfig;
  if (loadedTheme.assetsDir) {
    for (const rel of walkFiles(loadedTheme.assetsDir)) {
      const abs = path.join(loadedTheme.assetsDir, rel);
      const base = path.basename(rel);
      // less partial（_ 前缀，如 _highlight.less）仅作为 @import 源，不独立输出
      if (/\.less$/i.test(rel)) {
        if (base.startsWith("_")) continue;
        // less → css 编译
        const css = await compileLess(fs.readFileSync(abs, "utf8"), abs);
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
          type: assetType(rel),
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
  buildLog("Finished process");

  // ---- render ----
  const resolveCtx: ResolveContext = {
    assetsDirAbs,
    assets,
    postDirByPageId: scanned.postDirByPageId,
  };
  const styles = readThemeStyles(loadedTheme);
  const results: { page: Page; html: string }[] = [];
  for (const page of allPages) {
    await hooks.beforeRender.call(page);
    // 解析 cover（§3.2：parse 后按 9.3 规则解析为最终 URL）
    resolveCover(page, resolveCtx);
    // NOTE
    // 考虑可配置其他 Markdown render 后端
    const mdResult = await renderMarkdown(page.rawContent, page, {
      config: siteConfig,
      resolve: resolveCtx,
    });
    page.content = mdResult.html;
    page.metadata.toc = mdResult.toc;
    // NOTE
    // 需要明确一下 before/after render 是对 Markdown 文件的渲染阶段
    // 对于 HTML 的渲染阶段应该没有需要介入的场景吧？
    // 在 HTML 渲染后如果需要进行压缩，应该使用 write 阶段的 hooks
    await hooks.afterRender.call(page);
    const html = renderPage(loadedTheme, {
      site,
      page,
      config: siteConfig,
      styles,
    });
    results.push({ page, html });
  }
  buildLog("Finished render");

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
  buildLog("Finished write");

  return { config: siteConfig, site, pages: results };
}

// ---------- 内部工具 ----------

async function loadPlugins(config: SiteConfig, cwd: string, api: PluginAPI) {
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  for (const entry of config.plugins ?? []) {
    const resolve = typeof entry === "string" ? entry : entry.resolve;
    const options = typeof entry === "string" ? undefined : entry.options;
    let mod: unknown;
    if (resolve.startsWith(".") || path.isAbsolute(resolve)) {
      const abs = path.isAbsolute(resolve)
        ? resolve
        : path.resolve(cwd, resolve);
      mod = await jiti.import(abs);
    } else {
      mod = await import(resolve);
    }
    const candidate = (mod as { default?: unknown }).default ?? mod;
    const plugin: Plugin | undefined =
      typeof candidate === "function"
        ? (candidate as (opts?: unknown) => Plugin)(options)
        : (candidate as Plugin | undefined);
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
  // NOTE 考虑将草稿区集合名设置为可由配置定义
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

function resolveCover(page: Page, ctx: ResolveContext) {
  if (!page.cover) return;
  const resolveOne = (ref: string): string => {
    if (ref.startsWith("/") || /^https?:|^\/\//.test(ref)) return ref;
    const resolved = resolveAssetRef(ref, page, ctx);
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

/** less 编译：主题资源中的 .less 编译为 .css */
async function compileLess(source: string, filename: string): Promise<string> {
  const result = await less.render(source, { filename });
  return result.css;
}
