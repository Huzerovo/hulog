/**
 * 分类路径：从根到叶的完整层级，如 ["分类二", "子分类"]。
 * 顶层分类为单元素路径，如 ["分类一"]。
 */
export type CategoryPath = string[];

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

/**
 * Page —— 核心数据抽象
 * 每个源文件经解析后生成统一的 Page 对象，供模板和插件使用。
 */
export interface Page {
  /** 唯一标识，通常为源文件相对于项目根的路径，如 "content/posts/hello.md" */
  id: string;

  /** 所属集合名称 */
  collection: string;

  /** 源文件绝对路径；虚拟页面（生成器创建）为 null */
  sourcePath: string | null;

  /** 目标输出 URL，不含域名，以 "/" 开头，如 "/post/hello/" */
  url: string;

  /** 替代 URL 列表（如日期路径、别名等），用于生成额外页面或重定向 */
  aliases: string[];

  /** 文章标题，取自 front-matter 或文件名 */
  title: string;

  /** 创建日期：front-matter 的 date → 文件名 YYYY-MM-DD- 前缀（命中则用，可选增强）→ 均缺失时按集合规则处理 */
  /** 集合需要日期时（sortBy: "date"，或 routePattern/permalink 含 :year/:month/:day）缺失即报错；否则为 undefined */
  date?: Date;

  /** 最后修改日期：front-matter updated；缺失为 undefined，不报错、不输出 */
  updated?: Date;

  /** 标签列表 */
  tags: string[];

  /**
   * 分类列表（支持层级）：每个元素是一条从根到叶的完整路径，如 ["机器学习", "线性回归"]。
   * front-matter 写法见 parseCategories（字符串 / 数组 / 嵌套映射均支持）。
   */
  categories: CategoryPath[];

  /** 自定义 slug，用于生成 URL 的路径片段，默认取自文件名 */
  slug: string;

  /** 布局名称，用于模板选择 */
  layout: string;

  /** 是否为草稿：front-matter draft: true，或源路径位于 content/drafts/ 下（parse 阶段强制置 true） */
  draft: boolean;

  /** 文章摘要（front-matter 提供，或由插件生成） */
  excerpt?: string;

  /** 外链文章地址（front-matter link）；标题/卡片可跳转外链，详情页仍正常渲染 */
  link?: string;

  /** 封面：单个资源路径或候选数组（随机封面）；parse 阶段按 §9.3 解析为最终 URL */
  cover?: string | string[];

  /** 原始 Markdown 内容 */
  rawContent: string;

  /** 渲染后的 HTML 内容（render 阶段填充，初始为空字符串） */
  content: string;

  /** 所有 front-matter 原始键值对（不含上述已映射字段） */
  data: Record<string, unknown>;

  /** 页面的其他元数据，由插件或核心动态添加 */
  metadata: Record<string, unknown>;
}
