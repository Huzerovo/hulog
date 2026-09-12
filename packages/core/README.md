# @hulog/core

静态博客生成器核心：内容模型、构建管线、插件系统、主题加载与渲染。

## 定位

`@hulog/core` 负责将「Markdown 内容 + 站点配置 + 主题」构建为静态 HTML 站点，并通过 generator / hook / renderer / helper 提供可插拔扩展点。CLI 与 dev server 仅做薄封装，调用 `build()` 完成构建。

## 目录结构

```
src/
├── index.ts          # 公共 API 出口
├── build.ts          # 构建管线编排（唯一入口 build()）
├── core-api.ts       # CoreAPI（主题用）实现
├── config.ts         # 站点/主题配置加载（cosmiconfig + jiti）
├── path.ts           # 路径工具（toPosixPath）
├── plugins/          # 插件系统
│   ├── index.ts      # 发现/加载 + scoped API 组装 + 内置注册
│   ├── generator.ts  # 生成器注册表
│   ├── helper.ts     # helper 注册表 + 核心 helper
│   ├── hook.ts       # tapable 异步钩子
│   ├── renderer.ts   # 渲染器注册表
│   └── builtin/      # 内置 generator（home/archive/taxonomy）
├── theme/            # 主题系统
│   ├── index.ts      # loadTheme / resolveThemeDir（esbuild bundle）
│   └── render.ts     # renderPage（preact-render-to-string）
├── sequence/         # read / parse / collect / generate / write
├── site.ts           # Site 实现
├── collection.ts     # Collection 实现
├── route.ts          # slug / URL / 路由占位符解析
├── category.ts       # 分类解析、分类树构建
├── pagination.ts     # 分页工具（以 helper 注册）
├── assets.ts         # 资源扫描与引用解析
├── markdown.ts       # unified/remark/rehype 渲染管线
└── types/            # 全部公共类型定义（按域拆分）
```

## 构建管线

`build()`（`build.ts`）按固定阶段顺序执行，阶段边界触发 hook：

```
init → read → parse → filter → collect①(物理) → generate → merge → collect②(虚拟) → process → render → write
```

| 阶段 | 作用 | 输入/产物 |
|------|------|-----------|
| **init** | 加载主题、创建 Site、建注册表 + scoped API、加载插件 | SiteConfig → Site / CoreAPI |
| **read** | 扫描内容目录 | 目录 → FileEntry[] |
| **parse** | 单文件解析 | FileEntry → Page[]（物理页） |
| **filter** | 过滤（生产删除 draft） | Page[] → filteredPages |
| **collect①(物理)** | 物理页按 collection 分组 | filteredPages → Collection[] → site.collections |
| **generate** | generator 基于 site 生成虚拟页 | Site → virtualPages |
| **merge** | 物理 + 虚拟合并、URL 冲突检测 | → allPages |
| **collect②(虚拟)** | 虚拟页挂入集合（动态建 core:virtual） | virtualPages → site.collections |
| **process** | 扫描资源 + 主题资源（less 编译） | → site.assets |
| **render** | Markdown → HTML，套用主题布局 | Page → { page, html } |
| **write** | 写入 dist、复制 public/ | 结果 → 文件 |

### 关键实现细节

- **插件 + 主题加载（init 阶段）**：`build()` 先加载主题并合并主题配置，创建 `SiteImpl`，再 `initCorePlugins()` 建注册表 + scoped API，`loadThemePlugins`/`loadSitePlugins` 加载插件，`new CoreApiImpl(...)` 得到主题用 `CoreAPI`；插件按文件名前缀注入**作用域化** API。
- **hook 生命周期**：`initHooks()`（`hook.ts`）创建全部异步钩子；hook 插件经 `api.hook.*` 注册，核心在各阶段边界触发。
- **生成器**（generate）：generator 插件经 `api.generator.register(name, (site) => Page[])` 注册，返回无源文件的虚拟 Page。
- **renderer**（render）：`render` 为单一职责（Markdown → HTML+toc），经 `api.renderer.register` 覆盖默认；`beforeRender`/`afterRender` 可 hook。
- **helper**：`api.helper.get(name)` 读取、`register(name, fn)` 注册；核心内置分类/分页/日期等 helper。
- **草稿区**：`content/drafts/` 内文章强制 `draft`，生产阶段由 filter 剔除，dev 下经 `/draft/:slug/` 预览。
- **URL 冲突检测**（`checkUrlConflicts`）：merge 阶段对全部页面 URL 去重校验。

## 插件系统

插件在可配置目录（默认 `plugins/`，经 `config.pluginsDir` 指定）中按文件名前缀自动发现，无需在配置中列举。每个插件默认导出 `(api) => void | Promise<void>`，`api` 按前缀**作用域化**（互不越权）：

```ts
// plugins/generator-archive.ts  → api: GeneratorAPI  { config, cwd, generator, helper }
// plugins/hook-search.ts        → api: HookAPI       { config, cwd, hook }
// plugins/renderer-custom.ts    → api: RendererAPI   { config, cwd, renderer }
// plugins/helper-my.ts          → api: HelperAPI     { config, cwd, helper }
```

- 无前缀文件（共享工具等）不加载，但 **build 时警告**（`index.*` 主题入口除外）。
- generator 可使用 helper，但**不能**触及 hooks/renderers；hook/renderer 也不能触及彼此。

```ts
// generator
import type { GeneratorAPI } from "@hulog/core";
export default function (api: GeneratorAPI) {
  api.generator.register("archive", (site) => []);
  api.helper.register("myHelper", (x) => x);
  const paginate = api.helper.get("paginate");
}

// hook
import type { HookAPI } from "@hulog/core";
export default function (api: HookAPI) {
  api.hook.afterWrite.tap("search", () => {});
}

// renderer（覆盖默认 markdown 渲染）
import type { RendererAPI } from "@hulog/core";
export default function (api: RendererAPI) {
  api.renderer.register("markdown", (raw, page, ctx) => ({ html: "", toc: [] }));
}
```

## 数据模型

核心抽象均定义在 `types/`，实现在对应 `*.ts`。

- **Page**（`types/page.ts`）：单篇文章的统一抽象，含 `id`、`collection`、`url`、`slug`、`layout`、`draft`、`tags`/`categories`、`content`（渲染后 HTML）、`data`（其余 front-matter）、`metadata`（插件动态扩展）等。
- **Collection**（`types/collection.ts`）：内容集合，聚合该集合全部 Page，支持按 `sortBy`/`sortOrder` 排序（`getPages(sorted)`）。
- **Site**（`types/site.ts`）：全局站点对象，持有全部集合；提供 `pages`、`publishedPages`、`assets` 只读视图与 `getAssets(dir)` 查询。
- **Asset**（`types/asset.ts`）：资源对象（文章专属 + 全局），含 `sourcePath`、`url`、`buffer`、`type`、`belongsTo`。

## 配置系统

- **加载**（`config.ts`）：cosmiconfig 搜索 `blog.config.*`（ts/js/mjs/yaml/json），TS/ESM 经 jiti 加载。
- **defineConfig**（`config/define.ts`）：对象或函数形式，统一并入默认值（`assetsDir`、`contentDir`、`markdown`、`server`、`cli` 等）。
- **主题配置**（`loadThemeConfig`）：独立 `theme.config.*` 文件，与站点 `themeConfig` 内联合并，优先级：主题默认 < 站点 `theme.config.ts` < `blog.config.ts` 内联 `themeConfig`。

## 主题系统

- **加载**（`theme/index.ts` `loadTheme`）：`resolveThemeDir` 定位主题目录（`themes/<name>` → `node_modules/<name>` → 直接路径）；esbuild 将 `index.ts` bundle 为 ESM 后 import；并合并 `theme.config.ts` 到 `theme.config`。主题入口导出 `Theme` 对象。
- **preact 单实例**：preact 系列模块通过 alias + external 与核心进程共享同一实例，保证 `context`/`hooks` 与 `preact-render-to-string` 互通。
- **helper 访问（无虚拟模块）**：`LayoutProps = { page, api }`，`api` 为 `CoreAPI`（`api.site` / `api.theme.config` / `api.helper`）；主题根布局将 `api` 注入 Preact Context，组件经 `api.helper.get("themeAsset")("...")` 使用 helper。
- **渲染**（`renderPage`）：按 `page.layout` 选择布局，回退链 `精确 → default → page`，preact-render-to-string 输出 HTML。
- **资源输出**：主题 `assetsDir` 内资源并入站点；`themeAssetsMode` 决定前缀（`merge → /assets`、`namespace → /assets/<theme>`）；`.less` 编译为 CSS（`_` 前缀 partial 仅作 @import 源）。

## 资源处理

- **扫描**（`assets.ts` `scanAssets`）：文章同名专属目录内文件 → 专属 Asset（URL = 页面 URL + 相对路径）；`assetsDir` 内文件 → 全局 Asset（`/assets/...`）；其他散落文件进 `stray` 警告列表。
- **引用解析**（`resolveAssetRef`）：外部/锚点/查询原样；`/assets/` 校验存在；相对路径先查专属目录（命中保持相对引用）再查全局 `assetsDir`（命中重写为 `/assets/...`）；未命中返回 `null` 由调用方报错。
- **renderer 资源上下文**：renderer 经 `RenderContext { config, assets: AssetRegistry }` 取配置、用 `assets.resolve(ref, page)` 解析引用（不再直接暴露 `ResolveContext`）。
- **process 阶段**：hook 插件经 `api.hook.afterProcess.tap()` 遍历并改写 `Asset[]`（如压缩）。

## Markdown 渲染

`markdown.ts` 以 unified 构建管线：

```
remark-parse → remark-gfm → remark-math → remark-rehype(allowDangerousHtml)
  → rehype-raw → rehype-slug → 目录收集 → 资源引用解析
  → rehype-mermaid（```mermaid → .mermaid 容器）
  → rehype-katex → @shikijs/rehype（构建时高亮）→ rehype-stringify
```

- **代码高亮**：shiki 动态加载语言集合，模块级单例复用；`markdown.highlight`/`clientHighlight` 可开关。
- **目录**：收集 h1–h3 生成 `toc`（跳过 GFM 脚注区块）。
- **KaTeX**：`markdown.katex` 开关。
- **Mermaid**：`markdown.mermaid` 开关（默认 true）。```mermaid 代码块被转为 `<pre class="mermaid">` 并跳过 shiki，由主题客户端按需加载 mermaid.js 渲染，并放入 Shadow DOM 隔离（固定浅色背景），支持滚轮缩放 / 拖拽平移（见 `example/themes/huzerovo`）。

## 公共 API（`index.ts`）

- `build(options)` — 主构建入口。
- `initHooks()` — 构建阶段 hook 集。
- `loadSiteConfig` / `defineConfig` — 配置加载与定义。
- `loadTheme` / `renderPage` / `resolveThemeDir` — 主题相关。
- `renderMarkdown` — 内置默认 Markdown 渲染（可作为默认 renderer）。
- `RendererRegistryImpl` — renderer 注册表实现。
- `parseCategories` / `buildCategoryTree` / `categoryPathToUrl` — 分类工具。
- `pageUrl` / `paginate` / `pinSort` — 分页工具（以 helper 形式注册）。
- `scanAssets` / `resolveAssetRef` — 资源工具。
- `SiteImpl` / `CollectionImpl` / `AsyncHookImpl` — 实现类。
- API 类型：`CoreAPI`（主题用：`site` / `theme` / `helper`）、`Registries`（内部编排）、`GeneratorAPI` / `HookAPI` / `RendererAPI` / `HelperAPI`（按插件类型作用域化）、`RuntimeContext`。
