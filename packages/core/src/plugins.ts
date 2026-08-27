/**
 * 从插件目录自动发现并加载插件：
 * - generator-*.ts / hook-*.ts / renderer-*.ts 按前缀注入统一 api（含 plugins 命名空间）
 * - 无前缀文件（如共享工具）忽略并警告
 */

import { createJiti } from "jiti";

import fs from "node:fs";
import path from "node:path";

import type { Site } from "./types/site.js";
import type { SiteConfig } from "./types/config.js";
import type { GeneratorRegistry } from "./types/generator.js";
import type { Renderer, RendererRegistry } from "./types/renderer.js";
import type { HelperRegistry } from "./types/helper.js";
import type { Hooks } from "./types/hook.js";
import { HelperRegistryImpl, registerCoreHelpers } from "./helper.js";
import { GeneratorRegistryImpl } from "./generator.js";
import { RendererRegistryImpl } from "./renderer.js";
import { initHooks } from "./hook.js";
import homeGenerator from "./generators/generator-home.js";
import archiveGenerator from "./generators/generator-archive.js";
import taxonomyGenerator from "./generators/generator-taxonomy.js";
import { renderMarkdown } from "./markdown.js";

export type PluginKind = "generator" | "hook" | "renderer" | "helper";

/** 插件类型与文件名前缀的映射（前缀用于校验与分类，api 统一传入） */
const PLUGIN_PREFIX_RE = /^(generator|hook|renderer|helper)-(.+)\.(ts|tsx|js|mjs|cjs)$/;

/** 创建统一 api 并注册内置插件（helper / generator），返回可供插件与主题使用的 PluginAPI */
export function initCorePlugins(config: SiteConfig, cwd: string): PluginAPI {
  const helper: HelperRegistry = new HelperRegistryImpl();
  registerCoreHelpers(helper);

  const generator: GeneratorRegistry = new GeneratorRegistryImpl();
  const renderer: RendererRegistry = new RendererRegistryImpl();
  renderer.register("markdown", renderMarkdown as Renderer);
  const hook = initHooks();

  const api: PluginAPI = {
    config,
    cwd,
    plugins: {
      generators: generator,
      helpers: helper,
      hooks: hook,
      renderers: renderer,
    },
  };

  // 内置 generator（home / archive / taxonomy）：注册后站点/主题插件可同名覆盖
  registerCoreGenerators(api);

  return api;
}

/** 内置 generator 注册（initCorePlugins 阶段调用） */
export function registerCoreGenerators(api: PluginAPI): void {
  homeGenerator(api);
  archiveGenerator(api);
  taxonomyGenerator(api);
}

/** 主题插件目录加载（build 阶段调用）：themes/<theme>/ 下的 generator-/hook- 等 */
export async function loadThemePlugins(
  api: PluginAPI,
  cwd: string,
  themeName: string,
): Promise<void> {
  await loadPlugins(path.join(cwd, "themes", themeName), api);
}

/** 站点插件目录加载（build 阶段调用）：pluginsDir（默认 plugins/）下的插件 */
export async function loadSitePlugins(api: PluginAPI, cwd: string): Promise<void> {
  await loadPlugins(path.join(cwd, api.config.pluginsDir ?? "plugins"), api);
}

export async function loadPlugins(
  pluginsDir: string,
  api: PluginAPI,
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
    // 主题入口（index.*）由 loadTheme 单独加载，不作为插件扫描
    if (/^index\.(ts|tsx|js|mjs|cjs)$/.test(name)) continue;
    const m = PLUGIN_PREFIX_RE.exec(name);
    if (!m) {
      // 无前缀文件：非插件（工具/共享模块），忽略并警告
      console.warn(`[warn] 插件目录中 "${name}" 无类型前缀，已忽略（需 generator- / hook- / renderer- 前缀）`);
      continue;
    }
    const file = path.join(pluginsDir, name);
    let mod: unknown;
    try {
      mod = await jiti.import(file);
    } catch (err) {
      console.warn(`[warn] 插件加载失败，已跳过：${name}\n  ${(err as Error).message}`);
      continue;
    }
    const fn = (mod as { default?: unknown; }).default ?? mod;
    if (typeof fn !== "function") {
      console.warn(`[warn] 插件 "${name}" 未导出函数，已跳过`);
      continue;
    }
    await fn(api);
  }
}



/**
 * 插件系统
 * 插件按文件前缀分为 generator / hook / renderer 三类，在可配置目录（默认 plugins/）中自动发现。
 * 每个插件文件默认导出 `(api) => void | Promise<void>`，api 为统一 PluginAPI（含 plugins 命名空间）。
 * 主题入口同样以 `(api) => Theme` 函数形式接收统一 api。
 * 钩子采用 tapable 风格：同步/异步顺序执行。
 */

/**
 * 统一插件 api：config / cwd / site 为共享基础，四类能力收敛到 plugins 命名空间。
 */
export interface PluginAPI {
  /** 访问站点配置 */
  config: SiteConfig;
  /** 项目根目录 */
  cwd: string;
  /** 站点对象（afterInit 之后可用） */
  site?: Site;
  /** 注册/使用能力命名空间 */
  plugins: {
    hooks: Hooks;
    generators: GeneratorRegistry;
    renderers: RendererRegistry;
    helpers: HelperRegistry;
  };
}

/** generator 插件 api（plugins/generator-*.ts） */
export type GeneratorAPI = PluginAPI;
/** hook 插件 api（plugins/hook-*.ts） */
export type HookAPI = PluginAPI;
/** renderer 插件 api（plugins/renderer-*.ts） */
export type RendererAPI = PluginAPI;
/** 主题 api（themes/<name>/index.ts 默认导出函数入参） */
export type ThemeAPI = PluginAPI;
