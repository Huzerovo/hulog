import { cosmiconfig } from "cosmiconfig";
import { createJiti } from "jiti";
import type { SiteConfig } from "./types/config.js";
import { CONTENT_BASE } from "./types/config.js";

const MODULE_NAME = "blog";

/** 配置文件搜索顺序 */
const SEARCH_PLACES = [
  "blog.config.ts",
  "blog.config.js",
  "blog.config.mjs",
  "blog.config.yaml",
  "blog.config.yml",
  "blog.config.json",
];

/** 主题配置文件搜索顺序（独立于站点配置） */
const THEME_CONFIG_PLACES = [
  "theme.config.ts",
  "theme.config.js",
  "theme.config.mjs",
  "theme.config.yaml",
  "theme.config.yml",
  "theme.config.json",
];

/** jiti 加载 TS/ESM 配置（cosmiconfig loader 复用） */
function makeTsLoader() {
  return async (filepath: string) => {
    const jiti = createJiti(import.meta.url, {
      interopDefault: true,
    });
    const mod: any = await jiti.import(filepath);
    return mod.default ?? mod;
  };
}

/**
 * 加载站点配置：
 * cosmiconfig 负责查找配置文件，TS/ESM 配置经 jiti 动态加载。
 */
export async function loadSiteConfig(cwd: string): Promise<SiteConfig> {
  const explorer = cosmiconfig(MODULE_NAME, {
    searchPlaces: SEARCH_PLACES,
    loaders: {
      ".ts": makeTsLoader(),
      ".js": makeTsLoader(),
    },
  });

  const defaults: Partial<SiteConfig> = {
    assetsDir: "assets",
    contentDir: CONTENT_BASE,
    markdown: { highlight: true, katex: true, clientHighlight: false },
    server: { port: 3000, hot: true },
    pluginsDir: "plugins",
    language: "zh-CN",
    perPage: 10,
    archivesDir: "archive",
    paginationDir: "page",
  };

  const result = await explorer.search(cwd);
  if (!result || result.isEmpty) {
    throw new Error(
      `未找到配置文件（${SEARCH_PLACES.join(" / ")}），请先运行 ${process.title} init`,
    );
  }
  return { ...defaults, ...result.config } as SiteConfig;
}

/**
 * 加载站点级主题配置（theme.config.ts，可选）：
 * 与站点配置分离、独立覆盖主题自带默认配置（合并优先级：主题默认 < 站点 theme.config.ts < blog.config.ts 内联 themeConfig）。
 * 文件不存在时返回 undefined（主题使用自带默认配置）。
 */
export async function loadThemeConfig(
  cwd: string,
): Promise<Record<string, unknown> | undefined> {
  const explorer = cosmiconfig("theme", {
    searchPlaces: THEME_CONFIG_PLACES,
    loaders: {
      ".ts": makeTsLoader(),
      ".js": makeTsLoader(),
    },
  });

  const result = await explorer.search(cwd);
  if (!result || result.isEmpty) return undefined;
  return result.config as Record<string, unknown>;
}
