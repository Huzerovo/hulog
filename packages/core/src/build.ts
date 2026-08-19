import fs from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";
import less from "less";
import { AsyncHookImpl } from "./hook.js";
import { loadSiteConfig, loadThemeConfig } from "./config.js";
import { SiteImpl, CollectionImpl } from "./site.js";
import { parseFile } from "./parse.js";
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
import { toPosixPath } from "./path.js";
import { registerCoreHelpers } from "./helpers.js";
import { RendererRegistryImpl } from "./renderer.js";
import type {
  Asset,
  Collection,
  FileEntry,
  GeneratorAPI,
  HookAPI,
  Hooks,
  Page,
  RendererAPI,
  Renderer,
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

  // 本次构建独立的 helper 注册表：插件经 api.helper.register 注册，主题经虚拟模块使用。
  // 每次 build 新建，避免 dev 热重建 / 多次构建之间累积与泄漏。
  const helpers: HelperRegistry = createHelperRegistry();
  registerCoreHelpers(helpers);
  setCurrentHelpers(helpers);

  const generators: {
    name: string;
    fn: (site: Site) => Page[] | Promise<Page[]>;
  }[] = [];
  const rendererRegistry = new RendererRegistryImpl();
  // 内置默认 renderer（markdown 渲染）；用户 renderer 经 api.renderer.register 覆盖之
  rendererRegistry.register("markdown", renderMarkdown as Renderer);

  // 各类型插件 api：共享 config / cwd / helper / site
  const base = { config: siteConfig, cwd, helper: helpers };
  const generatorApi: GeneratorAPI = {
    ...base,
    generator: {
      register(name, fn) {
        generators.push({ name, fn });
      },
    },
  };
  const hookApi: HookAPI = { ...base, hook: hooks };
  const rendererApi: RendererAPI = { ...base, renderer: rendererRegistry };

  // ---- 插件：在 init 之前加载，确保全流程 hook 生效（含 beforeInit/afterInit） ----
  const pluginsDir = path.join(cwd, siteConfig.pluginsDir ?? "plugins");
  await loadPlugins(pluginsDir, {
    generator: generatorApi,
    hook: hookApi,
    renderer: rendererApi,
  });
  buildLog("Loaded Plugins");

  // ---- init ----
  await hooks.beforeInit.call(siteConfig);
  const site = new SiteImpl();
  await hooks.afterInit.call(site);
  generatorApi.site = site;
  hookApi.site = site;
  rendererApi.site = site;

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
  const mdFiles = files.filter((f) => !f.isAsset);
  const pageById = new Map<string, Page>();
  for (const f of mdFiles) {
    // NOTE
    // 似乎是在替换 Windows 风格的路径？但是 Linux 上似乎允许存在 `\` 但是应该也没有人会用这样奇怪的路径名吧？
    const rel = toPosixPath(path.relative(contentRoot, f.absolutePath));
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
    const page = parseFile(f.absolutePath, rel, collectionConfig.name, collectionConfig);
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
  site.setAssets(scanned.assets as Asset[]);
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
        site.assets.push({
          sourcePath: abs,
          url: prefix + "/" + toPosixPath(cssRel),
          buffer: Buffer.from(css),
          type: "css",
          belongsTo: "global",
        });
      } else {
        site.assets.push({
          sourcePath: abs,
          url: prefix + "/" + toPosixPath(rel),
          buffer: fs.readFileSync(abs),
          type: assetType(rel),
          belongsTo: "global",
        });
      }
    }
  }
  const assets = site.assets;
  await hooks.beforeProcess.call(assets);
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
    // render 阶段：单一职责，只做 Markdown → HTML + toc；由当前 renderer 执行（内置默认可被覆盖）
    const renderer = rendererRegistry.get();
    if (!renderer) throw new Error("未注册任何 renderer");
    const mdResult = await renderer(page.rawContent, page, {
      config: siteConfig,
      resolve: resolveCtx,
    });
    page.content = mdResult.html;
    page.metadata.toc = mdResult.toc;
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

/** 插件类型与文件名前缀的映射 */
type PluginKind = "generator" | "hook" | "renderer";
const PLUGIN_PREFIX_RE = /^(generator|hook|renderer)-(.+)\.(ts|tsx|js|mjs|cjs)$/;

/**
 * 从插件目录自动发现并加载插件：
 * - generator-*.ts / hook-*.ts / renderer-*.ts 按前缀注入对应类型 api
 * - 无前缀文件（如共享工具）忽略并警告
 */
async function loadPlugins(
  pluginsDir: string,
  apis: Record<PluginKind, GeneratorAPI | HookAPI | RendererAPI>,
): Promise<void> {
  if (!fs.existsSync(pluginsDir)) {
    console.warn(
      `[warn] 插件目录不存在，跳过插件加载：${pluginsDir}`,
    );
    return;
  }
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  const files = fs
    .readdirSync(pluginsDir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name);
  for (const name of files) {
    const m = PLUGIN_PREFIX_RE.exec(name);
    if (!m) {
      // 无前缀文件：非插件（工具/共享模块），忽略并警告
      console.warn(`[warn] 插件目录中 "${name}" 无类型前缀，已忽略（需 generator- / hook- / renderer- 前缀）`);
      continue;
    }
    const kind = m[1] as PluginKind;
    const file = path.join(pluginsDir, name);
    let mod: unknown;
    try {
      mod = await jiti.import(file);
    } catch (err) {
      console.warn(`[warn] 插件加载失败，已跳过：${name}\n  ${(err as Error).message}`);
      continue;
    }
    const fn = (mod as { default?: unknown }).default ?? mod;
    if (typeof fn !== "function") {
      console.warn(`[warn] 插件 "${name}" 未导出函数，已跳过`);
      continue;
    }
    await fn(apis[kind]);
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
          path: toPosixPath(path.relative(projectRoot, abs)),
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
