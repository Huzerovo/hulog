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
 * 每个插件文件默认导出 `(api) => void | Promise<void>`，api 类型由前缀决定。
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

/** 模板辅助函数注册表（统一 registry 风格） */
export interface HelperRegistry {
  register(name: string, fn: Function): void;
}

/** 全部类型插件共享的基础能力 */
export interface PluginBase {
  /** 访问站点配置 */
  config: SiteConfig;
  /** 项目根目录 */
  cwd: string;
  /** 站点对象（afterInit 之后可用） */
  site?: Site;
  /** 注册模板辅助函数（TSX 组件内可 import；核心内置 assetUrl/themeAsset/pickCover 等） */
  helper: HelperRegistry;
}

/** generator 插件 api（plugins/generator-*.ts） */
export interface GeneratorAPI extends PluginBase {
  generator: GeneratorRegistry;
}

/** hook 插件 api（plugins/hook-*.ts） */
export interface HookAPI extends PluginBase {
  hook: Hooks;
}

/** renderer 插件 api（plugins/renderer-*.ts） */
export interface RendererAPI extends PluginBase {
  renderer: RendererRegistry;
}
