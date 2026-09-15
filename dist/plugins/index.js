/**
 * 插件系统：按文件前缀自动发现并加载插件，向每类插件注入**作用域化** API。
 *
 * - generator-*.ts → GeneratorAPI（generator + helper）
 * - hook-*.ts      → HookAPI（hook）
 * - renderer-*.ts  → RendererAPI（renderer）
 * - helper-*.ts    → HelperAPI（helper）
 *
 * 无前缀文件（共享工具）忽略并警告。
 */
import { createJiti } from "jiti";
import fs from "node:fs";
import path from "node:path";
import { HelperRegistryImpl, registerCoreHelpers } from "./helper.js";
import { GeneratorRegistryImpl } from "./generator.js";
import { RendererRegistryImpl } from "./renderer.js";
import { initHooks } from "./hook.js";
import homeGenerator from "./builtin/generator-home.js";
import archiveGenerator from "./builtin/generator-archive.js";
import taxonomyGenerator from "./builtin/generator-taxonomy.js";
import vpageGenerator from "./builtin/generator-vpage.js";
import { renderMarkdown } from "../markdown.js";
/** 插件类型与文件名前缀的映射（前缀用于校验与分类） */
const PLUGIN_PREFIX_RE = /^(generator|hook|renderer|helper)-(.+)\.(ts|tsx|js|mjs|cjs)$/;
/**
 * 创建注册表并组装 scoped 插件 API。site 需已创建（helpers 绑定 site）。
 * 内置 generator 以 GeneratorAPI 注册。
 */
export async function initCorePlugins(site, cwd) {
    // 提前加载 core helper，generator 中可能使用
    const helper = new HelperRegistryImpl(site);
    registerCoreHelpers(helper);
    const generator = new GeneratorRegistryImpl();
    const renderer = new RendererRegistryImpl();
    renderer.register("markdown", renderMarkdown);
    const hook = initHooks();
    const registries = {
        generators: generator,
        helpers: helper,
        hooks: hook,
        renderers: renderer,
    };
    const config = site.config;
    const scoped = {
        generator: { config, cwd, generator, helper },
        hook: { config, cwd, hook },
        renderer: { config, cwd, renderer },
        helper: { config, cwd, helper },
    };
    // 内置 generator（core:home / core:archives / core:taxonomy）
    registerCoreGenerators(scoped.generator);
    return { registries, scoped };
}
/** 内置 generator 注册（initCorePlugins 阶段调用） */
export function registerCoreGenerators(api) {
    homeGenerator(api);
    archiveGenerator(api);
    taxonomyGenerator(api);
    vpageGenerator(api);
}
/** 主题插件目录加载（build 阶段调用）：themes/<theme>/plugins/ 下的 generator-/hook- 等 */
export async function loadThemePlugins(scoped, cwd, themeName) {
    // 主题插件可选：目录不存在时不告警
    await loadPlugins(path.join(cwd, "themes", themeName, "plugins"), scoped);
}
/** 站点插件目录加载（build 阶段调用）：pluginsDir（默认 plugins/）下的插件 */
export async function loadSitePlugins(scoped, cwd, site) {
    await loadPlugins(path.join(cwd, site.config.pluginsDir ?? "plugins"), scoped);
}
export async function loadPlugins(pluginsDir, scoped) {
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
            console.warn(`[warn] 插件目录中 "${name}" 无类型前缀，已忽略（需 generator- / hook- / renderer- / helper- 前缀）`);
            continue;
        }
        const kind = m[1];
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
        await fn(scoped[kind]);
    }
}
//# sourceMappingURL=index.js.map