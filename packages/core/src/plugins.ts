/**
 * 从插件目录自动发现并加载插件：
 * - generator-*.ts / hook-*.ts / renderer-*.ts 按前缀注入对应类型 api
 * - 无前缀文件（如共享工具）忽略并警告
 */

import { createJiti } from "jiti";

import fs from "node:fs";
import path from "node:path";

import { GeneratorAPI, HookAPI, PluginKind, RendererAPI } from "./types/plugins.js";

/** 插件类型与文件名前缀的映射 */
const PLUGIN_PREFIX_RE = /^(generator|hook|renderer)-(.+)\.(ts|tsx|js|mjs|cjs)$/;

async function loadCorePlugins() {
  // NOTE
  // 使用 import 导入，而非 jiti
}

async function loadThemePlugins() { }

async function loadSitePlugins() { }

export async function loadPlugins(
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
    const fn = (mod as { default?: unknown; }).default ?? mod;
    if (typeof fn !== "function") {
      console.warn(`[warn] 插件 "${name}" 未导出函数，已跳过`);
      continue;
    }
    await fn(apis[kind]);
  }
}
