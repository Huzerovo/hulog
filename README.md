# hulog

静态博客生成器 —— Hexo 的内容管理方式 + Astro 的现代化架构。

用 Markdown 写文章，用 TSX 组件写主题，构建输出纯静态 HTML（默认零客户端 JavaScript）。

## 特性

- **Markdown 写作**：兼容 Hexo front-matter，GFM 语法（表格 / 任务列表 / 脚注 / 删除线 / 自动链接）
- **LaTeX 公式**：KaTeX 构建时渲染，无需客户端 JS
- **代码高亮**：@shikijs 构建时高亮
- **内容集合（Collections）**：每个目录是一个集合，路由、排序、front-matter 校验均可配置
- **分类层级**：分类支持任意深度子分类（嵌套 front-matter 写法），父分类页自动聚合子分类文章
- **TSX 主题**：preact 组件即主题，`preact-render-to-string` 构建时渲染
- **插件系统**：8 阶段构建管线 + tapable 风格钩子，可注册虚拟页面生成器（归档 / 分页 / 标签 / RSS 等）
- **资源两级体系**：文章专属资源 + 站点/主题全局资源，引用自动解析
- **草稿工作流**：`content/drafts/` 草稿区，dev 预览，`publish` 一键发布
- **开发服务器**：文件监听 + 热重载，dev 模式渲染草稿

## 快速开始

```bash
# 1. 安装依赖并构建
pnpm install
pnpm build

# 2. 全局链接 CLI（或直接用 node packages/cli/dist/index.js）
pnpm link --dir packages/cli

# 3. 创建新站点
hulog init my-blog
cd my-blog

# 4. 写文章 & 开发预览
hulog new "我的第一篇文章"     # 默认写入草稿区
hulog dev                     # http://localhost:3000

# 5. 发布 & 构建
hulog publish 我的第一篇文章
hulog build                   # 输出到 dist/
```

## CLI 命令

| 命令                   | 说明                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `hulog init [dir]`     | 创建新站点（生成 blog.config.ts / content/ 骨架）                                            |
| `hulog dev`            | 启动开发服务器（热重载，草稿可预览）                                                         |
| `hulog build`          | 生产构建，输出 `dist/`                                                                       |
| `hulog clean`          | 清理输出目录                                                                                 |
| `hulog new <title>`    | 创建新文章，默认写入 `content/drafts/`（`cli.newPostDraft: false` 时直接写入目标集合）       |
| `hulog publish <slug>` | 发布草稿：移入目标集合、自动补 `date`、移除 `draft` 标记；`--all` 发布全部；同名冲突报错拒绝 |

## 站点配置

站点根目录的 `blog.config.ts`（或 `.js` / `.yaml`），TypeScript 配置经 jiti 动态加载：

```ts
import { defineConfig } from "@hulog/core";

export default defineConfig({
  siteTitle: "My Blog",
  description: "A static blog",
  url: "https://example.com",
  theme: "my-theme", // themes/<name>/ 或 node_modules/<name>/
  content: { rootDir: "content" },
  assetsDir: "assets", // 站点全局资源目录
  collections: [
    {
      name: "posts",
      sourceDir: "posts",
      routePattern: "/post/:slug/",
      defaultLayout: "post",
      sortBy: "date",
      sortOrder: "desc",
    },
    {
      name: "pages",
      sourceDir: "pages",
      routePattern: "/:slug/",
      defaultLayout: "page",
    },
  ],
  markdown: { highlight: true, katex: true },
  server: { port: 3000, hot: true },
  cli: { newPostDraft: true },
  plugins: ["./plugins/home.ts", { resolve: "rss", options: { limit: 20 } }],
});
```

主题配置独立：`theme.config.ts`（可选）覆盖主题自带默认配置。合并优先级：
主题默认 `config` < 站点 `theme.config.ts` < `blog.config.ts` 内联 `themeConfig`。

## 内容模型

```
content/
├── posts/          # 集合 "posts"，默认路由 /post/:slug/
├── drafts/         # 草稿区：强制 draft: true，仅 dev 预览
├── pages/          # 集合 "pages"，通用页面
└── docs/           # 任意自定义集合
```

### front-matter

| 字段               | 说明                                                            |
| ------------------ | --------------------------------------------------------------- |
| `title`            | 标题（缺省用文件名）                                            |
| `date` / `updated` | 日期；集合需要日期时缺失即报错；也支持文件名 `YYYY-MM-DD-` 前缀 |
| `slug`             | 自定义 slug                                                     |
| `tags`             | 标签列表                                                        |
| `categories`       | 分类列表，**支持子分类**（见下）                                |
| `layout`           | 布局名（默认取集合 `defaultLayout`）                            |
| `draft`            | 草稿标记                                                        |
| `excerpt`          | 摘要                                                            |
| `link`             | 外链文章地址                                                    |
| `cover`            | 封面（单路径或候选数组，构建时按 slug 哈希确定性选择）          |
| `permalink`        | 永久链接覆盖，支持 `:year` `:month` `:day` `:slug` 变量         |

### 分类子分类

```yaml
categories:
  - 分类一 # 普通分类
  - 分类二: # 嵌套 → 子分类（任意深度）
      - 子分类1
      - 子分类2
  - 分类三/子分类 # "父/子" 路径写法
```

- 分类页 URL 为完整路径：`/categories/分类二/子分类1/`；父分类页包含直接与间接子分类的所有文章
- 旧写法完全兼容：`categories: [a, b]`（两个顶层分类）、`- [机器学习]`
- 主题侧可用核心注册的 helper：`categoryPathToString` / `categoryPathToUrl` / `buildCategoryTree`

## 主题开发

主题是一个目录（或 npm 包），入口 `index.ts` 默认导出 `Theme` 对象：

```
themes/my-theme/
├── index.ts            # 导出布局映射 + 主题默认配置
├── components/         # 可复用组件
├── layouts/            # 布局组件
├── assets/             # 主题资源（构建时整合进站点）
└── styles/             # 样式（.less 构建时编译）
```

```ts
// themes/my-theme/index.ts
export default {
  name: "my-theme",
  layouts: {
    post: PostLayout,
    page: PageLayout,
    index: HomeLayout,
    default: PageLayout, // 布局回退链：default → page
  },
  assetsDir: "assets",
  assetsMode: "merge", // merge | namespace
} satisfies Theme;
```

布局组件是纯函数组件，props：`{ site, page, config, styles? }`。

```tsx
// layouts/PostLayout.tsx
import type { LayoutProps } from "@hulog/core";

export default function PostLayout({ page }: LayoutProps) {
  return (
    <article>
      <h1>{page.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: page.content }} />
    </article>
  );
}
```

**约定与限制**：

- 构建时渲染：不能使用 `useState` / `useEffect` 等客户端钩子与事件绑定，所有数据构建时确定
- 主题资源引用：核心注册 helper（虚拟模块 `hulog:helpers`）——`assetUrl(path)`（站点全局资源）、`themeAsset(path)`（主题资源）、`pickCover(page)`、分类工具等
- 主题定位顺序：`themes/<name>/` 本地目录 → `node_modules/<name>/`；esbuild 将主题入口 bundle 为 ESM，preact 单实例共享

## 插件系统

```ts
import type { Plugin } from "@hulog/core";

export default function myPlugin(): Plugin {
  return {
    name: "reading-time",
    apply(api) {
      api.hooks.afterParse.tap("reading-time", (collections) => {
        for (const col of collections) {
          for (const page of col.pages) {
            page.metadata.readingTime = Math.ceil(
              page.rawContent.split(/\s+/).length / 200,
            );
          }
        }
      });
    },
  };
}
```

### 构建管线与钩子

```
init → read → parse → filter → generate → process → render → write
```

每个阶段前后均有钩子（tapable 风格）：`beforeInit/afterInit`、`beforeRead/afterRead`、`beforeParse/afterParse`、`beforeFilter/afterFilter`、`beforeGenerate/afterGenerate`、`beforeProcess/afterProcess`、`beforeRender/afterRender`、`beforeWrite/afterWrite`。

- **generate**：插件注册 `api.generator.register(name, (site) => Page[])` 生成虚拟页面（归档 / 分页 / 标签 / RSS…），核心检测 URL 冲突
- **process**：`api.process(handler)` 注册资源处理器（图片压缩 / CSS 编译 / JS 打包）
- **render**：按 `page.layout` 选择主题布局渲染为 HTML

## 资源体系

- **文章专属资源**：与文章同名的目录（`content/posts/hello.md` + `content/posts/hello/hero.png`），输出到页面目录，Markdown 相对引用结构对齐无需改写
- **全局资源**：站点 `assetsDir`（输出 `dist/assets/`）；主题 `assetsDir` 默认合并模式（站点同名资源优先），可选 namespace 模式
- **引用解析**：相对路径 → 专属目录 → 全局目录 → 报错；`/assets/` 绝对路径 → 全局；外链 / 锚点原样保留

## 开发

```bash
pnpm install
pnpm dev            # 监听 core/cli 的 tsc 增量编译
pnpm typecheck      # 全量类型检查
```
