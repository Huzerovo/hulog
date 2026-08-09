import type { Site } from "./site.js";
import type { SiteConfig } from "./config.js";
import type { Collection } from "./collection.js";
import type { Page } from "./page.js";
import type { Asset } from "./asset.js";

/**
 * 插件系统
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
  beforeRender: AsyncHook<[Page]>; // 可拦截并替换默认渲染
  afterRender: AsyncHook<[Page]>; // 可修改 page.content
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

/** 资源处理器（process 阶段） */
export interface AssetProcessor {
  (assets: Asset[]): void | Promise<void>;
}

/**
 * PluginAPI —— 插件可用的全部能力
 */
export interface PluginAPI {
  /** 注册钩子 */
  hooks: Hooks;
  /** 注册生成器 */
  generator: GeneratorRegistry;
  /** 注册模板辅助函数（TSX 组件内可 import；核心内置 assetUrl/themeAsset/pickCover 等） */
  helper(name: string, fn: Function): void;
  /** 注册自定义资源处理器 */
  process(handler: AssetProcessor): void;
  /** 添加虚拟模块（供主题引用） */
  addVirtualModule(name: string, content: string): void;
  /** 访问站点配置 */
  config: SiteConfig;
  /** 站点对象（afterInit 之后可用） */
  site?: Site;
  /** 项目根目录 */
  cwd: string;
}

/**
 * Plugin —— 插件定义（npm 包或本地文件默认导出）
 */
export interface Plugin {
  name: string;
  apply(api: PluginAPI): void | Promise<void>;
}
