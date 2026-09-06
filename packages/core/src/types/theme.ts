import type { ComponentType } from "preact";
import type { Page } from "./page.js";
import type { ThemeCustomConfig } from "./config.js";
import { CoreAPI } from "./api.js";

/**
 * 主题系统
 */

/** 布局组件 props：页面 + 统一 api（经 api.site / api.theme 访问站点与主题） */
export interface LayoutProps {
  /** 当前渲染的页面 */
  page: Page;
  /** 统一插件 api：api.site（含 .config）/ api.theme（含 .config） */
  api: CoreAPI;
}

/** 布局组件：纯函数组件，构建时渲染，禁止客户端钩子与事件绑定 */
export type LayoutComponent = ComponentType<LayoutProps>;

/** 布局配置 */
export type LayoutsConfig = Record<string, LayoutComponent>;

/**
 * Theme —— 主题入口默认导出（themes/<name>/index.ts）
 */
export interface Theme {
  /** 主题名 */
  name: string;

  /** 主题配置（build 合并主题默认 + theme.config.ts 后写入，经 api.theme.config 访问） */
  config?: ThemeCustomConfig;

  /** 布局映射：page.layout → 组件；fallback 链为 default → page */
  layouts: LayoutsConfig;
}
