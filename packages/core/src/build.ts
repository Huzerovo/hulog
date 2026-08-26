import fs from "node:fs";
import path from "node:path";
import less from "less";
import { AsyncHookImpl } from "./hook.js";
import { loadSiteConfig, loadThemeConfig } from "./config.js";
import { SiteImpl } from "./site.js";
import { seqParse } from "./sequence/parse.js";
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
  type HelperRegistry,
} from "./runtime.js";
import { toPosixPath } from "./path.js";
import { registerCoreHelpers } from "./helpers.js";
import { RendererRegistryImpl } from "./renderer.js";
import type {
  Asset,
  FileEntry,
  Hooks,
  Page,
  PluginAPI,
  Renderer,
  Site,
  SiteConfig,
} from "./types/index.js";
import { loadPlugins } from './plugins.js';
import seqRead from "./sequence/read.js";

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

function initHooks(): Hooks {
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
  // NOTE
  // 注意，cwd 默认为 process.cwd()，但是可以被 CLI dev --base 参数改写
  // 另外 CLI build 命令暂时没有添加参数改写的功能，已做标记，记得添加
  const cwd = path.resolve(options.cwd ?? process.cwd());

  // NOTE siteConfig 在 loadSiteConfig 应该被完全赋值
  // TODO 写一个 test 用于验证
  const siteConfig = await loadSiteConfig(cwd);

  const hooks = initHooks();

  // 本次构建独立的 helper 注册表：插件/主题经 api.plugins.helper 注册与使用。
  // 每次 build 新建，避免 dev 热重建 / 多次构建之间累积与泄漏。
  const helpers: HelperRegistry = createHelperRegistry();
  registerCoreHelpers(helpers);

  const generators: {
    name: string;
    fn: (site: Site) => Page[] | Promise<Page[]>;
  }[] = [];
  const rendererRegistry = new RendererRegistryImpl();
  // 内置默认 renderer（markdown 渲染）；用户 renderer 经 api.plugins.renderer.register 覆盖
  rendererRegistry.register("markdown", renderMarkdown as Renderer);

  // 统一插件 api：四类能力收敛到 plugins 命名空间，插件与主题共享同一对象
  const api: PluginAPI = {
    config: siteConfig,
    cwd,
    plugins: {
      generator: {
        register(name, fn) {
          generators.push({ name, fn });
        },
      },
      hook: hooks,
      renderer: rendererRegistry,
      helper: helpers,
    },
  };

  // ---- 插件 + 主题：在 init 之前加载，确保全流程 hook 生效（含 beforeInit/afterInit） ----
  // 主题入口与插件共享同一 api，可注册 generator/helper/hook。
  const sitePluginsDir = path.join(cwd, siteConfig.pluginsDir ?? "plugins");
  const themePluginsDir = path.join(cwd, "themes", siteConfig.theme);
  await loadPlugins(themePluginsDir, api);
  await loadPlugins(sitePluginsDir, api);
  buildLog("Loaded Plugins");

  // ---- init ----
  // NOTE 感觉 init 阶段的 hook 不是很有必要
  await hooks.beforeInit.call(siteConfig);
  const site = new SiteImpl(siteConfig);
  await hooks.afterInit.call(site);
  api.site = site;

  // ---- 主题加载（提前到 generate 之前：主题可注册 generator，供 generate 阶段使用） ----
  const loadedTheme = await loadTheme(siteConfig.theme, cwd, api);
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

  const contentRoot = path.join(cwd, siteConfig.content?.rootDir ?? "content");
  const assetsDir = siteConfig.assetsDir ?? "assets";
  const assetsDirAbs = path.join(cwd, assetsDir);

  // ---- read ----
  // NOTE beforeRead 阶段的 hook 好像也有点意义不明
  await hooks.beforeRead.call();
  const files: FileEntry[] = seqRead(contentRoot, cwd);
  await hooks.afterRead.call(files);
  buildLog("Finished read");

  // ---- parse ----
  // TODO 阶段拆分
  await hooks.beforeParse.call(files);
  const collections = seqParse(siteConfig, contentRoot, files);
  for (const col of collections) {
    // NOTE 添加正式发布是否允许草稿
    if (!options.dev && col.config.isDrafts) continue;
    site.collections.set(col.name, col);
  };
  await hooks.afterParse.call(collections);
  buildLog("Finished parse");

  // TODO 
  // 考虑在这里添加一个 collect 阶段
  // parse 返回 PagesIndex，这里根据 PagesIndex 生成 collections
  // 生成 collections 之后经过 filter 阶段再写入 site



  // ---- filter ----
  // NOTE
  // 这个阶段有点意义不明了 
  // 是否应该将 parse 拆分成两个阶段，一个生成 Pages，一个生成 Collections
  // 这个阶段则专注于设置 site.collections，不需要使 collection 耦合在 parse 阶段
  await hooks.beforeFilter.call(collections);
  // TODO 添加选项允许非 dev 时构建草稿
  if (!options.dev) {
    for (const col of collections) {
      if (!col.config.isDrafts) {
        col.pages = col.pages.filter((p) => !p.draft);
      }
    }
  }
  await hooks.afterFilter.call(collections);
  buildLog("Finished filter");

  // ---- generate ----
  // NOTE 这里的 pages 可能在上一阶段剔除了草稿
  const allPages = [...site.pages];
  await hooks.beforeGenerate.call(allPages);
  // NOTE 
  // generator 的实现需要再进一步设计，如将常用的 archive, category, tags 页面移到内置实现。
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
  // 主题资源（主题模块已提前加载，prefix 已确定）
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
  const results: { page: Page; html: string; }[] = [];
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
      api,
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
  // NOTE
  // 与 assets 的定位有些冲突？比如完全可以有一个 siteRoot/public/assets 文件夹，这样配置 SiteConfig.assetsDir 的含义就有歧义了：
  // assetsDir 既可以代表 public 下的文件夹名称，也可以表示 siteRoot 下的文件夹名称
  // 且由于这个是最后的阶段了，public 中的 assets 优先级极高，可能会破坏之前配置好的 assets URL
  const publicDir = path.join(cwd, "public");
  if (fs.existsSync(publicDir)) {
    copyDir(publicDir, distDir);
  }
  await hooks.afterWrite.call();
  buildLog("Finished write");

  return { config: siteConfig, site, pages: results };
}

// ---------- 内部工具 ----------


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
