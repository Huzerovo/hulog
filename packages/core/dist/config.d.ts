import type { SiteConfig } from "./types/config.js";
/**
 * 加载站点配置：
 * cosmiconfig 负责查找配置文件，TS/ESM 配置经 jiti 动态加载。
 */
export declare function loadSiteConfig(cwd: string): Promise<SiteConfig>;
/**
 * 加载站点级主题配置（theme.config.ts，可选）：
 * 与站点配置分离、独立覆盖主题自带默认配置（合并优先级：主题默认 < 站点 theme.config.ts < blog.config.ts 内联 themeConfig）。
 * 文件不存在时返回 undefined（主题使用自带默认配置）。
 */
export declare function loadThemeConfig(cwd: string): Promise<Record<string, unknown> | undefined>;
