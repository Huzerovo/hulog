import fs from "node:fs";
import path from "node:path";
import less from "less";
import { loadSiteConfig } from "./config.js";
import { SiteImpl } from "./site.js";
import { seqParse } from "./sequence/parse.js";
import {
  loadTheme,
  renderPage,
} from "./theme/index.js";
import {
  scanAssets,
  resolveAssetRef,
  assetType,
  type ResolveContext,
} from "./assets.js";
import { toPosixPath } from "./path.js";
import type { Asset } from "./types/asset.js";
import type { Page } from "./types/page.js";
import type { SiteConfig } from "./types/config.js";
import { CONTENT_BASE } from "./types/config.js";
import type { GeneratorCallback } from "./types/generator.js";
import type { AssetRegistry, RenderContext } from "./types/renderer.js";
import type { FileEntry, RenderResult } from "./types/sequence.js";
import seqRead from "./sequence/read.js";
import { seqCollect, collectVirtual } from "./sequence/collect.js";
import { seqWrite } from "./sequence/write.js";
import { CoreApiImpl } from "./core-api.js";
import { initCorePlugins, loadThemePlugins, loadSitePlugins } from "./plugins/index.js";
import { seqGenerate } from "./sequence/generate.js";

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

let buildMiddleCount = 0;
let isDev = false;
function dumpMiddle(obj: any, file: string) {
  if (!isDev) return;

  const cwd = process.cwd();
  const output = path.join(cwd, "buildMid");
  buildMiddleCount += 1;
  fs.mkdirSync(output, { recursive: true });
  const jstr = JSON.stringify(obj);
  fs.writeFileSync(path.join(output, buildMiddleCount.toString() + '_' + file), jstr);
}

export async function build(options: BuildOptions = {}): Promise<BuildResult> {
  // 考虑创建一个 utils.logger ？
  const buildLog = (msg: string) => console.log("  [build]: " + msg);
  // NOTE: 注意，cwd 默认为 process.cwd()，但是可以被 CLI dev --base 参数改写，另外 CLI build 命令暂时没有添加参数改写的功能，已做标记，记得添加
  const cwd = path.resolve(options.cwd ?? process.cwd());

  // NOTE: siteConfig 在 loadSiteConfig 应该被完全赋值
  // TODO: 写一个 test 用于验证
  const siteConfig = await loadSiteConfig(cwd);

  // ---- 主题加载 ----
  // 主题配置合并：主题默认 < theme.config.ts，结果写入 theme.config（经 api.theme.config 访问）
  const { theme, themePath } = await loadTheme(siteConfig.theme, cwd);

  // NOTE: 强制 dev 模式渲染草稿
  if (options.dev) {
    isDev = true;
    siteConfig.renderDraft = true;
  }

  // ---- site + init + 插件 ----
  // site 需先于 plugins 创建：helpers 绑定 site，插件/主题经 api 访问
  const site = new SiteImpl(siteConfig);
  // 建注册表 + scoped API（内置 generator 在此注册）
  const { registries, scoped } = await initCorePlugins(site, cwd);
  // 先主题插件、后站点插件（站点优先级更高）
  await loadThemePlugins(scoped, cwd, siteConfig.theme);
  await loadSitePlugins(scoped, cwd, site);
  // 主题布局使用的只读 API
  const core = new CoreApiImpl(cwd, site, theme, registries.helpers);
  const renderers = registries.renderers;
  const generators = registries.generators;
  const hooks = registries.hooks;
  buildLog("Loaded Plugins");
  await hooks.afterInit.call(site);

  const contentRoot = path.join(cwd, siteConfig.contentDir ?? CONTENT_BASE);
  const assetsDir = siteConfig.assetsDir ?? "assets";
  const assetsDirAbs = path.join(cwd, assetsDir);

  // ---- read ----
  // 文件读取阶段，同时读取文章文件与资源文件
  const files: FileEntry[] = seqRead(contentRoot, cwd);
  await hooks.afterRead.call(files);
  dumpMiddle(files, "read_FileEntry_files.json");
  buildLog("Finished read");

  // ---- parse ----
  // 物理页面生成阶段
  const physicsPage = seqParse(siteConfig, contentRoot, files);
  await hooks.afterParse.call(physicsPage);
  dumpMiddle(physicsPage, "parse_Page_physicsPage.json");
  buildLog(`Finished parse, total physics pages: ${physicsPage.length}`);

  // ---- filter ----
  const filteredPages: Page[] = [];
  if (siteConfig.renderDraft) {
    filteredPages.push(...physicsPage);
  } else {
    filteredPages.push(...physicsPage.filter((page) => !page.draft));
  }
  await hooks.afterFilter.call(filteredPages);
  dumpMiddle(filteredPages, "filter_Page_filteredPages.json");
  buildLog("Finished filter");

  // ---- collect①（物理）----
  // 将物理页面按 collection 分组，集合供 generate 阶段（site.collections）与后续使用
  const physicalCollections = seqCollect(siteConfig, filteredPages);
  for (const col of physicalCollections) {
    site.collections.set(col.name, col);
  }
  await hooks.afterCollectPhysical.call(physicalCollections);
  dumpMiddle(physicalCollections, "collectPhy_Collection_physicalCollections.json");
  buildLog("Finished collect(physical)");

  // ---- generate ----
  // 基于物理集合生成虚拟页面（archives / tagcloud 等）；虚拟页不依赖虚拟集合
  // generator 逐个执行（支持异步，串行 await）；站点/主题插件同名注册可覆盖内置
  const callbacks: GeneratorCallback[] = [];
  generators.forEach((fn) => callbacks.push(fn));
  const virtualPages: Page[] = await seqGenerate(site, callbacks);
  await hooks.afterGenerate.call(virtualPages);
  dumpMiddle(virtualPages, "generate_Page_virtualPages.json");
  buildLog("Finished generate");

  // ---- merge ----
  // 合并所有页面（物理页已过滤草稿，虚拟页来自 generate）
  const allPages: Page[] = [...filteredPages, ...virtualPages];
  checkUrlConflicts(allPages);
  await hooks.afterMerge.call(allPages);
  dumpMiddle(allPages, "merge_Page_allPages.json");
  buildLog(`Finished merge, all pages: ${allPages.length}`);

  // ---- collect②（虚拟）----
  // 将虚拟页挂入 site.collections（已存在则并入，否则动态创建如 core:virtual）
  const virtualCollections = collectVirtual(site.collections, virtualPages);
  await hooks.afterCollectVirtual.call(virtualCollections);
  dumpMiddle(virtualCollections, "mergeVir_Page_virtualCollections.json");
  buildLog("Finished collect(virtual)");

  // ---- process ----
  const scanned = scanAssets({ contentRoot, assetsDirAbs, pages: allPages });
  site.setAssets(scanned.assets as Asset[]);
  // 主题 assets 目录与 URL 前缀
  const themeAssetsDir = path.join(themePath, siteConfig.assetsDir ?? "assets");
  const prefix = siteConfig.themeAssetsMode === "namespace"
    ? `/${siteConfig.assetsDir ?? "assets"}/${theme.name}`
    : `/${siteConfig.assetsDir ?? "assets"}`;
  // 主题资源（主题模块已提前加载，prefix 已确定；目录可缺失）
  if (fs.existsSync(themeAssetsDir)) {
    for (const rel of walkFiles(themeAssetsDir)) {
      const abs = path.join(themeAssetsDir, rel);
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
  // 面向 renderer 的资源上下文（隐藏 ResolveContext 内部细节）
  const assetRegistry: AssetRegistry = {
    list: assets,
    resolve: (ref, page) => resolveAssetRef(ref, page, resolveCtx),
  };
  const renderCtx: RenderContext = { config: siteConfig, assets: assetRegistry };
  const results: RenderResult[] = [];
  for (const page of allPages) {
    await hooks.beforeRender.call(page);
    // 解析 cover（§3.2：parse 后按 9.3 规则解析为最终 URL）
    resolveCover(page, resolveCtx);
    // render 阶段：单一职责，只做 Markdown → HTML + toc；由当前 renderer 执行（内置默认可被覆盖）
    const renderer = renderers.get('markdown');
    if (!renderer) throw new Error("未注册任何 renderer");
    // NOTE: 考虑改用 Promise.all 异步执行，现在只有 3 个物理页，渲染时间却到秒级了
    const mdResult = await renderer(page.rawContent, page, renderCtx);
    page.content = mdResult.html;
    page.metadata.toc = mdResult.toc;
    await hooks.afterRender.call(page);

    buildLog("render page: " + page.title);
    const html = renderPage(theme, {
      page,
      api: core,
    });
    results.push({ page, html });
  }
  buildLog("Finished render");

  // 创建 dist 文件夹，此文件夹作为网站最终的 root
  const distDir = path.join(cwd, "dist");
  if (!options.dev) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });
  // ---- write ----
  await hooks.beforeWrite.call(
    results.map((r) => r.page),
    assets,
  );

  seqWrite(distDir, results, assets);
  // public/ 直接复制
  // NOTE: 与 assets 的定位有些冲突？
  // TODO: 加个 public/assets 检测警告
  // 比如完全可以有一个 siteRoot/public/assets 文件夹，这样配置 SiteConfig.assetsDir 的含义就有歧义了：
  // assetsDir 既可以代表 public 下的文件夹名称，也可以表示 siteRoot 下的文件夹名称
  // 且由于这个是最后的阶段了，public 中的 assets 优先级极高，可能会破坏之前配置好的 assets URL
  const publicDir = path.join(cwd, "public");
  if (fs.existsSync(publicDir)) {
    copyDir(publicDir, distDir);
  }
  await hooks.afterWrite.call();
  buildLog("Finished write");

  buildMiddleCount = 0;
  return { config: siteConfig, site, pages: results };
}

// ---------- 内部工具 ----------

function checkUrlConflicts(pages: Page[]) {
  const seen = new Map<string, string>();
  for (const p of pages) {
    // 忽略尾斜杠差异："/search" 与 "/search/" 输出同一 index.html，视为冲突
    const key = p.url.replace(/\/+$/, "");
    const prev = seen.get(key);
    if (prev) {
      throw new Error(`URL 冲突: "${p.url}"（${prev} 与 ${p.id}）`);
    }
    seen.set(key, p.id);
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
