import type { Site } from "./site.js";
import type { SiteConfig } from "./config.js";
import type { Collection } from "./collection.js";
import type { Page } from "./page.js";
import type { Asset } from "./asset.js";
import type { RendererRegistry } from "./renderer.js";

export type PluginKind = "generator" | "hook" | "renderer";

/**
 * 插件系统
 * 插件按文件前缀分为 generator / hook / renderer 三类，在可配置目录（默认 plugins/）中自动发现。
 * 每个插件文件默认导出 `(api) => void | Promise<void>`，api 为统一 PluginAPI（含 plugins 命名空间）。
 * 主题入口同样以 `(api) => Theme` 函数形式接收统一 api。
 * 钩子采用 tapable 风格：同步/异步顺序执行。
 */

/** tapable 风格异步钩子 */
export interface AsyncHook<T extends unknown[]> {
  /** 注册监听函数（按注册顺序执行） */
  tap(name: string, fn: (...args: T) => void | Promise<void>): void;
  /** 触发全部监听函数 */
  call(...args: T): Promise<void>;
}

/** 源文件条目（read 阶段产物） */
export interface FileEntry {
  /** 相对项目根的路径，如 "content/posts/hello.md" */
  path: string;
  /** 绝对路径 */
  absolutePath: string;
  /** 是否为资源文件（非 Markdown） */
  isAsset: boolean;
}

/** 全部构建阶段钩子 */
export interface Hooks {
  beforeInit: AsyncHook<[SiteConfig]>; // 修改配置
  afterInit: AsyncHook<[Site]>;
  beforeRead: AsyncHook<[]>;
  afterRead: AsyncHook<[FileEntry[]]>;
  beforeParse: AsyncHook<[FileEntry[]]>;
  afterParse: AsyncHook<[Collection[]]>; // 集合视角；全局数组视角在 afterFilter 后经 site.pages 获取
  beforeFilter: AsyncHook<[Collection[]]>;
  afterFilter: AsyncHook<[Collection[]]>;
  beforeGenerate: AsyncHook<[Page[]]>;
  afterGenerate: AsyncHook<[Page[]]>;
  beforeProcess: AsyncHook<[Asset[]]>;
  afterProcess: AsyncHook<[Asset[]]>;
  beforeRender: AsyncHook<[Page]>; // 渲染前拦截（不可替换 render，仅可修改 page/准备）
  afterRender: AsyncHook<[Page]>; // 渲染后可修改 page.content / metadata
  beforeWrite: AsyncHook<[Page[], Asset[]]>;
  afterWrite: AsyncHook<[]>;
}

/** 生成器注册表：产生虚拟页面（无源文件） */
export interface GeneratorRegistry {
  register(
    name: string,
    generator: (site: Site) => Page[] | Promise<Page[]>,
  ): void;
}

/** 模板辅助函数注册表：register 注册，get 读取（主题/插件经 api.plugins.helper 使用） */
export interface HelperRegistry {
  register(name: string, fn: Function): void;
  get(name: string): Function | undefined;
}

/**
 * 统一插件 api：config / cwd / site 为共享基础，四类能力收敛到 plugins 命名空间。
 */
export interface PluginAPI {
  /** 访问站点配置 */
  config: SiteConfig;
  /** 项目根目录 */
  cwd: string;
  /** 站点对象（afterInit 之后可用） */
  site?: Site;
  /** 注册/使用能力命名空间 */
  plugins: {
    generator: GeneratorRegistry;
    hook: Hooks;
    renderer: RendererRegistry;
    helper: HelperRegistry;
  };
}

/** generator 插件 api（plugins/generator-*.ts） */
export type GeneratorAPI = PluginAPI;
/** hook 插件 api（plugins/hook-*.ts） */
export type HookAPI = PluginAPI;
/** renderer 插件 api（plugins/renderer-*.ts） */
export type RendererAPI = PluginAPI;
/** 主题 api（themes/<name>/index.ts 默认导出函数入参） */
export type ThemeAPI = PluginAPI;
