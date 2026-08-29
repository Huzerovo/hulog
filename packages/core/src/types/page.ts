/**
 * NOTE 分类可以是高维数组，在 yaml 中表示为：
 * - A
 *   - B1
 *     - C
 *   - B2
 */
export type CategoryPath = string[];

export const VIRTUAL_PAGE_COLLECTION = "core:virtual";

// front-matter 字段
export const RESERVED_KEYS = new Set([
  "title",
  "date",
  "updated",
  "tags",
  "categories",
  "slug",
  "layout",
  "draft",
  "excerpt",
  "link",
  "cover",
  "permalink",
]);

/**
 * 分类树节点（分类页/树形展示用）。
 * count 为该分类直接或间接（含后代子分类）包含的文章数。
 */
export interface CategoryNode {
  /** 节点名（单层，如 "子分类"） */
  name: string;
  /** 完整路径（从根到本节点） */
  path: CategoryPath;
  /** 直接或通过子分类包含的文章数 */
  count: number;
  /** 子分类 */
  children: CategoryNode[];
}

// 生成一个页面所必须的选项，这个通常
export interface PageBase {
  // 用于标识唯一页面，一般使用文件系统的相对 content 路径
  // 虚拟页面需要手动指定
  id: string,
  // 目标输出 URL，不含域名，以 "/" 开头，如 "/post/hello/"
  // 虚拟页面需要手动指定，物理页面的自动生成
  url: string,
  // 页面标题
  title: string,
  // 布局，虚拟页面手动指定特殊 layout，物理页面根据 SiteConfig 自动生成（post 或者 page）
  layout: string,
}

// 文章页面的选项
export interface PagePostOptional {
  // 文章创建/发布时间
  date: Date;
  // 文章更新时间
  updated: Date;
  // 草稿标记
  draft?: boolean;
  // 文章标签
  tags?: string[];
  // 文章分类
  categories?: CategoryPath[];
  // 外链，用于外部文章
  link?: string;
  // 封面
  cover?: string | string[];
  // 文章摘要
  excerpt?: string;
}

// 通用的一般选项，一般用于构建过程
export interface PageOptional {
  // 所属集合名称
  collection: string;
  // 源文件绝对路径；虚拟页面（生成器创建）为 null
  sourcePath: string | null;
  // 替代 URL 列表（如日期路径、别名等），用于生成额外页面或重定向 
  aliases: string[];
  // 自定义 slug，用于生成 URL 的路径片段，默认取自文件名 
  slug: string;
  // 文章原始内容
  rawContent: string;
  // 渲染后的内容
  content: string;
  // 所有非核心使用的键值对
  data: Record<string, unknown>;
  // 页面的其他元数据，由插件或核心动态添加
  metadata: Record<string, unknown>;
}

/**
 * Page —— 核心数据抽象
 * 每个源文件经解析后生成统一的 Page 对象，供模板和插件使用。
 * 所有构建选项均被赋值为非 undefine 默认值
 */
export type Page = PageBase & Partial<PagePostOptional> & PageOptional;

// 文章类型
export type Post = Pick<PageBase, "title"> & PagePostOptional;

