import type { ComponentType } from "preact";
import type { Site } from "./site.js";
import type { Page } from "./page.js";
import type { SiteConfig } from "./config.js";
import { PluginAPI } from "../plugins.js";

/**
 * 主题系统
 */

/** 布局组件 props */
export interface LayoutProps {
  /** 完整的站点数据，包含所有集合和页面 */
  site: Site;
  /** 当前渲染的页面 */
  page: Page;
  /** 站点配置 */
  config: SiteConfig;
  /** 主题 globalStyles 的 CSS 文本（核心注入，由主题决定渲染位置） */
  styles?: string;
  /** 统一插件 api（经 api.plugins.helper.get 使用 helper，主题根布局可注入 Context） */
  api: PluginAPI;
}

/** 布局组件：纯函数组件，构建时渲染，禁止客户端钩子与事件绑定 */
export type LayoutComponent = ComponentType<LayoutProps>;

/** 主题资源输出模式 */
export type AssetsMode = "merge" | "namespace";

/**
 * Theme —— 主题入口默认导出（themes/<name>/index.ts）
 */
export interface Theme {
  /** 主题名 */
  name: string;

  /** 主题自带默认配置（站点 theme.config.ts 覆盖之，合并后注入 config.themeConfig） */
  config?: Record<string, unknown>;

  /** 布局映射：page.layout → 组件；fallback 链为 default → page */
  layouts: Record<string, LayoutComponent>;

  /** 主题资源目录，构建时整合进站点（见 §9.2） */
  assetsDir?: string;

  /** 资源输出模式：merge（默认，合并到 dist/assets/）| namespace（dist/assets/<theme-name>/） */
  assetsMode?: AssetsMode;

  /** 全局样式文件路径，核心读取后以 styles prop 注入 */
  globalStyles?: string;
}
