/**
 * 插件系统
 * 插件按文件前缀分为 generator / hook / renderer 三类，在可配置目录（默认 plugins/）中自动发现。
 * 每个插件文件默认导出 `(api) => void | Promise<void>`，api 为统一 PluginAPI（含 plugins 命名空间）。
 * 主题入口同样以 `(api) => Theme` 函数形式接收统一 api。
 * 钩子采用 tapable 风格：同步/异步顺序执行。
 *
 * 从插件目录自动发现并加载插件：
 * - generator-*.ts / hook-*.ts / renderer-*.ts 按前缀注入统一 api（含 plugins 命名空间）
 * - 无前缀文件（如共享工具）忽略并警告
 */

import { createJiti } from "jiti";

import fs from "node:fs";
import path from "node:path";

import type { Site } from "./types/site.js";
import type { GeneratorRegistry } from "./types/generator.js";
import type { Renderer, RendererRegistry } from "./types/renderer.js";
import type { HelperRegistry } from "./types/helper.js";
import { HelperRegistryImpl, registerCoreHelpers } from "./helper.js";
import { GeneratorRegistryImpl } from "./generator.js";
import { RendererRegistryImpl } from "./renderer.js";
import { initHooks } from "./hook.js";
import homeGenerator from "./generators/generator-home.js";
import archiveGenerator from "./generators/generator-archive.js";
import taxonomyGenerator from "./generators/generator-taxonomy.js";
import { renderMarkdown } from "./markdown.js";
import { CoreAPI, PluginsAPI } from "./types/api.js";

export type PluginKind = "generator" | "hook" | "renderer" | "helper";

/** 插件类型与文件名前缀的映射（前缀用于校验与分类，api 统一传入） */
const PLUGIN_PREFIX_RE = /^(generator|hook|renderer|helper)-(.+)\.(ts|tsx|js|mjs|cjs)$/;

/** 创建统一 api 并注册内置插件（helper / generator）。site 需已创建（helpers 绑定 site）。 */
export async function initCorePlugins(site: Site, cwd: string): Promise<PluginsAPI> {
  // 提前加载 core helper，generator 中可能使用
  const helper: HelperRegistry = new HelperRegistryImpl(site);
  registerCoreHelpers(helper);

  const generator: GeneratorRegistry = new GeneratorRegistryImpl();
  const renderer: RendererRegistry = new RendererRegistryImpl();
  renderer.register("markdown", renderMarkdown as Renderer);
  const hook = initHooks();

  const plugins: PluginsAPI = {
    generators: generator,
    helpers: helper,
    hooks: hook,
    renderers: renderer,
  };

  // 内置 generator（core:home / core:archives / core:taxonomy）：以 core: 前缀命名，
  // 与站点/主题插件（如 "home"）区分；同名 register 仍会覆盖（Map set 语义）
  registerCoreGenerators(plugins);

  return plugins;
}

/** 内置 generator 注册（initCorePlugins 阶段调用） */
export function registerCoreGenerators(plugins: PluginsAPI): void {
  homeGenerator(plugins);
  archiveGenerator(plugins);
  taxonomyGenerator(plugins);
}

/** 主题插件目录加载（build 阶段调用）：themes/<theme>/plugins/ 下的 generator-/hook- 等 */
export async function loadThemePlugins(
  plugins: PluginsAPI,
  cwd: string,
  themeName: string,
): Promise<void> {
  // 主题插件可选：目录不存在时不告警
  await loadPlugins(path.join(cwd, "themes", themeName, "plugins"), plugins);
}

/** 站点插件目录加载（build 阶段调用）：pluginsDir（默认 plugins/）下的插件 */
export async function loadSitePlugins(plugins: PluginsAPI, cwd: string, site: Site): Promise<void> {
  await loadPlugins(path.join(cwd, site.config.pluginsDir ?? "plugins"), plugins);
}

export async function loadPlugins(
  pluginsDir: string,
  plugins: PluginsAPI,
): Promise<void> {
  if (!fs.existsSync(pluginsDir)) {
    return;
  }
  console.warn(`[warn] 加载插件：${pluginsDir}`);
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
    await fn(plugins);
  }
}

/** generator 插件 api（plugins/generator-*.ts） */
export type GeneratorAPI = PluginsAPI;
/** hook 插件 api（plugins/hook-*.ts） */
export type HookAPI = PluginsAPI;
/** renderer 插件 api（plugins/renderer-*.ts） */
export type RendererAPI = PluginsAPI;
/** helper 插件 api */
export type HelperAPI = PluginsAPI;
/** 主题 api（themes/<name>/index.ts 默认导出函数入参） */
export type ThemeAPI = PluginsAPI;
