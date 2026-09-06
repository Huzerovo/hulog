import type { CollectionConfig } from "./collection.js";

/** 主题资源输出模式 */
export type ThemeAssetsMode = "merge" | "namespace";

// 文件夹定义

/** themes 目录 */
export const THEME_BASE = "themes";
/** 插件目录 */
export const PLUGINS_BASE = "plugins";
/** 内容目录 */
export const CONTENT_BASE = "content";
/** 归档页 */
export const ARCHIVES_BASE = "archives";
/** 文章集合名 */
export const POSTS_NAME = "posts";
/** 草稿集合名 */
export const DRAFTS_NAME = "drafts";
/** 页面目录 */
export const PAGES_NAME = "pages";
/** 网站资源目录 */
export const ASSETS_BASE = "assets";
/** 其他资源 */
export const PUBLIC_BASE = "public";

export interface MarkdownConfig {
  /** 是否启用代码高亮（rehype-shiki），默认 true */
  highlight?: boolean;
  /** 是否启用 KaTeX，默认 true */
  katex?: boolean;
  /** 是否交由客户端高亮（配合主题引入 highlight.js），默认 false */
  clientHighlight?: boolean;
}

export interface ServerConfig {
  /** 开发服务器端口，默认 3000 */
  port?: number;
  /** 是否启用热重载，默认 true */
  hot?: boolean;
}

/**
 * SiteConfig 站点配置
 */
export interface SiteConfig {
  /** 站点标题 */
  siteTitle: string;

  /** 站点副标题（拼入 <title>） */
  subtitle?: string;

  /** 站点描述 */
  description?: string;

  /** 站点作者（页脚等） */
  author?: string;

  /** 站点语言（i18n，默认 zh-CN） */
  language?: string;

  /** 站点 URL，如 "https://example.com" */
  url?: string;

  /** 主题名（本地 themes/<name> 或 npm 包）或路径 */
  theme: string;

  /*
   * 主题 assets 合并模式
   * - "merge": siteRoot/themes/default/assets + siteRoot/assets => /assets
   * - "namespace": siteRoot/themes/default/assets => /assets/default + siteRoot/assets => /assets
   */
  themeAssetsMode: ThemeAssetsMode;

  /** 内容根目录（相对项目根），默认 "content" */
  contentDir?: string;

  /** 站点全局资源目录，默认 "assets"，输出到 dist/assets/ */
  assetsDir?: string;

  /** 集合配置 */
  collections: CollectionConfig[];

  markdown?: MarkdownConfig;

  // 是否显示草稿
  renderDraft?: boolean;

  server?: ServerConfig;

  /** 列表每页文章数（分页插件使用），默认 10 */
  perPage?: number;

  /** 归档目录名，默认 "archive" */
  archivesDir?: string;

  /** 分页目录名，默认 "page" */
  paginationDir?: string;

  /** 默认分类（"uncategorized" 时启用未分类入口） */
  defaultCategory?: string;

  /** 订阅源配置 */
  feed?: { enable?: boolean; path?: string; };

  /** 插件目录（相对项目根，默认 "plugins"），自动按前缀发现 generator-/hook-/renderer- 插件 */
  pluginsDir?: string;
}

/**
 * ThemeConfig 主题配置
 */
export type ThemeCustomConfig = Record<string, unknown>;
