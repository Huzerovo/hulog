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
import { HelperRegistryImpl, registerCoreHelpers } from "./helper.js";
import { GeneratorRegistryImpl } from "./generator.js";
import { RendererRegistryImpl } from "./renderer.js";
import { initHooks } from "./hook.js";
import homeGenerator from "./generators/generator-home.js";
import archiveGenerator from "./generators/generator-archive.js";
import taxonomyGenerator from "./generators/generator-taxonomy.js";
import { renderMarkdown } from "./markdown.js";
/** 插件类型与文件名前缀的映射（前缀用于校验与分类，api 统一传入） */
const PLUGIN_PREFIX_RE = /^(generator|hook|renderer|helper)-(.+)\.(ts|tsx|js|mjs|cjs)$/;
/** 创建统一 api 并注册内置插件（helper / generator），返回可供插件与主题使用的 PluginAPI */
export function initCorePlugins(config, cwd) {
    const helper = new HelperRegistryImpl();
    registerCoreHelpers(helper);
    const generator = new GeneratorRegistryImpl();
    const renderer = new RendererRegistryImpl();
    renderer.register("markdown", renderMarkdown);
    const hook = initHooks();
    const api = {
        config,
        cwd,
        plugins: {
            generators: generator,
            helpers: helper,
            hooks: hook,
            renderers: renderer,
        },
    };
    // 内置 generator（core:home / core:archives / core:taxonomy）：以 core: 前缀命名，
    // 与站点/主题插件（如 "home"）区分；同名 register 仍会覆盖（Map set 语义）
    registerCoreGenerators(api);
    return api;
}
/** 内置 generator 注册（initCorePlugins 阶段调用） */
export function registerCoreGenerators(api) {
    homeGenerator(api);
    archiveGenerator(api);
    taxonomyGenerator(api);
}
/** 主题插件目录加载（build 阶段调用）：themes/<theme>/plugins/ 下的 generator-/hook- 等 */
export async function loadThemePlugins(api, cwd, themeName) {
    // 主题插件可选：目录不存在时不告警
    await loadPlugins(path.join(cwd, "themes", themeName, "plugins"), api);
}
/** 站点插件目录加载（build 阶段调用）：pluginsDir（默认 plugins/）下的插件 */
export async function loadSitePlugins(api, cwd) {
    await loadPlugins(path.join(cwd, api.config.pluginsDir ?? "plugins"), api);
}
export async function loadPlugins(pluginsDir, api) {
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
        if (/^index\.(ts|tsx|js|mjs|cjs)$/.test(name))
            continue;
        const m = PLUGIN_PREFIX_RE.exec(name);
        if (!m) {
            // 无前缀文件：非插件（工具/共享模块），忽略并警告
            console.warn(`[warn] 插件目录中 "${name}" 无类型前缀，已忽略（需 generator- / hook- / renderer- 前缀）`);
            continue;
        }
        const file = path.join(pluginsDir, name);
        let mod;
        try {
            mod = await jiti.import(file);
        }
        catch (err) {
            console.warn(`[warn] 插件加载失败，已跳过：${name}\n  ${err.message}`);
            continue;
        }
        const fn = mod.default ?? mod;
        if (typeof fn !== "function") {
            console.warn(`[warn] 插件 "${name}" 未导出函数，已跳过`);
            continue;
        }
        await fn(api);
    }
}
//# sourceMappingURL=plugins.js.map