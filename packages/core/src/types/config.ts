import type { CollectionConfig } from "./collection.js";

/**
 * 站点配置
 */

export interface ContentConfig {
  /** 内容根目录，默认 "content" */
  rootDir?: string;
}

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

export interface CliConfig {
  /** BIN_NAME new 默认写入 content/drafts/ 草稿区，默认 true；false 时直接写入目标集合 */
  newPostDraft?: boolean;
}

/**
 * SiteConfig —— 站点配置
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

  /** 主题配置（由主题消费，结构由主题定义） */
  themeConfig?: Record<string, unknown>;

  content?: ContentConfig;

  /** 站点全局资源目录，默认 "assets"，输出到 dist/assets/ */
  assetsDir?: string;

  /** 集合配置 */
  collections: CollectionConfig[];

  markdown?: MarkdownConfig;

  server?: ServerConfig;

  cli?: CliConfig;

  /** 列表每页文章数（分页插件使用），默认 10 */
  perPage?: number;

  /** 归档目录名，默认 "archive" */
  archiveDir?: string;

  /** 分页目录名，默认 "page" */
  paginationDir?: string;

  /** 默认分类（"uncategorized" 时启用未分类入口） */
  defaultCategory?: string;

  /** 订阅源配置 */
  feed?: { enable?: boolean; path?: string; };

  /** 插件目录（相对项目根，默认 "plugins"），自动按前缀发现 generator-/hook-/renderer- 插件 */
  pluginsDir?: string;
}
