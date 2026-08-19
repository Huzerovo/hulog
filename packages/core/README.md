# @hulog/core

静态博客生成器核心：内容模型、构建管线、插件系统、主题加载与渲染。

## 定位

`@hulog/core` 负责将「Markdown 内容 + 站点配置 + 主题」构建为静态 HTML 站点，并通过 generator / hook / renderer / helper 提供可插拔扩展点。CLI 与 dev server 仅做薄封装，调用 `build()` 完成构建。

## 目录结构

```
src/
├── index.ts          # 公共 API 出口
├── build.ts          # 构建管线编排（唯一入口 build()）
├── config.ts         # 站点配置加载（cosmiconfig + jiti）
├── config/define.ts  # defineConfig（应用默认值）
├── parse.ts          # 单文件 → Page 解析（front-matter）
├── route.ts          # slug / URL / 路由占位符解析
├── category.ts       # 分类解析、分类树构建
├── assets.ts         # 资源扫描与引用解析
├── site.ts           # Site / Collection 实现
├── theme.ts          # 主题加载（esbuild bundle）与渲染
├── markdown.ts       # unified/remark/rehype 渲染管线
├── hook.ts           # tapable 风格异步钩子
├── renderer.ts       # renderer 注册表实现
├── runtime.ts        # helper 注册表（构建隔离）
├── helpers.ts        # 内置核心 helper
├── path.ts           # 路径工具（toPosixPath）
├── constants.ts      # 全局常量（BIN_NAME）
└── types/            # 全部公共类型定义
```

## 构建管线

`build()`（`build.ts`）按固定阶段顺序执行，每阶段前后有 hook（`beforeX` / `afterX`）：

```
init → read → parse → filter → generate → process → render → write
```

| 阶段 | 作用 | 输入/产物 |
|------|------|-----------|
| **init** | 创建 Site（插件已在 init 前加载） | SiteConfig → Site |
| **read** | 扫描内容目录 | 目录 → FileEntry[] |
| **parse** | 单文件解析 | FileEntry → Page，聚合成 Collection |
| **filter** | 过滤（生产删除 draft） | Collection[] |
| **generate** | 插件生成虚拟页面 | Site → Page[] |
| **process** | 处理资源（压缩等） | Asset[] |
| **render** | Markdown → HTML，套用主题布局 | Page → { page, html } |
| **write** | 写入 dist、复制 public/ | 结果 → 文件 |

### 关键实现细节

- **插件加载（init 之前）**：`build()` 开头扫描可配置目录（默认 `plugins/`），按文件名前缀识别类型并注入对应 api，确保**全流程 hook（含 beforeInit/afterInit）生效**。
- **hook 生命周期**：`createHooks()`（`build.ts`）创建 `beforeX`/`afterX` 全部异步钩子；插件经 `api.hook.*` 注册，核心在各阶段边界触发。
- **生成器**（generate）：插件 `api.generator.register` 注册，返回无源文件的虚拟 Page，挂载到对应集合并参与 URL 冲突检测。
- **renderer**（render）：渲染拆为 `beforeRender → render → afterRender`。`render` 为单一职责（Markdown → HTML+toc）、不可 hook、可被用户 renderer 覆盖（内置 `renderMarkdown` 为默认）；`beforeRender`/`afterRender` 可 hook。
- **草稿区**：`content/drafts/` 内文章强制 `draft`，生产阶段由 filter 剔除，dev 下经 `/draft/:slug/` 预览。
- **URL 冲突检测**（`checkUrlConflicts`）：generate 阶段对全部页面 URL 去重校验。

## 插件系统

插件在可配置目录（默认 `plugins/`，经 `config.pluginsDir` 指定）中按文件名前缀自动发现，无需在配置中列举。每个插件默认导出 `(api) => void | Promise<void>`，`api` 类型由前缀决定：

```ts
// plugins/generator-archive.ts      → api: GeneratorAPI
// plugins/hook-search.ts            → api: HookAPI
// plugins/renderer-custom.ts        → api: RendererAPI
```

- 无前缀文件（共享工具等）不加载，但 **build 时警告**。
- 所有类型插件共享 `config` / `cwd` / `site?`（afterInit 后可用）与 `helper`（注册模板辅助函数）。
- 注册统一为 registry 风格：`api.generator.register`、`api.renderer.register`、`api.helper.register`；hook 经 `api.hook.beforeX.tap()` / `api.hook.afterX.tap()`。

```ts
// generator
import type { GeneratorAPI } from "@hulog/core";
export default function (api: GeneratorAPI) {
  api.generator.register("archive", (site) => []);
  api.helper.register("myHelper", (x) => x);
}

// hook
import type { HookAPI } from "@hulog/core";
export default function (api: HookAPI) {
  api.hook.afterWrite.tap("search", () => {});
}

// renderer（覆盖默认 markdown 渲染）
import type { RendererAPI } from "@hulog/core";
export default function (api: RendererAPI) {
  api.renderer.register("custom", (raw, page, ctx) => ({ html: "", toc: [] }));
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
- **defineConfig**（`config/define.ts`）：对象或函数形式，统一并入默认值（`assetsDir`、`content.rootDir`、`markdown`、`server`、`cli` 等）。
- **主题配置**（`loadThemeConfig`）：独立 `theme.config.*` 文件，与站点 `themeConfig` 内联合并，优先级：主题默认 < 站点 `theme.config.ts` < `blog.config.ts` 内联 `themeConfig`。

## 主题系统

- **加载**（`theme.ts` `loadTheme`）：`resolveThemeDir` 定位主题目录（`themes/<name>` → `node_modules/<name>` → 直接路径）；esbuild 将 `index.ts` bundle 为 ESM 后 import。
- **preact 单实例**：preact 系列模块通过 alias + external 与核心进程共享同一实例，保证 `context`/`hooks` 与 `preact-render-to-string` 互通。
- **helper 虚拟模块**：`hulog:helpers` 在 bundle 时按本次构建注册表生成导出，运行时间接经 `hulog:runtime` 读取当前注册表，实现主题内 `import { assetUrl } from "hulog:helpers"`。
- **渲染**（`renderPage`）：按 `page.layout` 选择布局，回退链 `精确 → default → page`，preact-render-to-string 输出 HTML。
- **资源输出**：主题 `assetsDir` 内资源并入站点；`assetsMode` 决定前缀（`merge → /assets`、`namespace → /assets/<theme>`）；`.less` 编译为 CSS（`_` 前缀 partial 仅作 @import 源）。

## 资源处理

- **扫描**（`assets.ts` `scanAssets`）：文章同名专属目录内文件 → 专属 Asset（URL = 页面 URL + 相对路径）；`assetsDir` 内文件 → 全局 Asset（`/assets/...`）；其他散落文件进 `stray` 警告列表。
- **引用解析**（`resolveAssetRef`）：外部/锚点/查询原样；`/assets/` 校验存在；相对路径先查专属目录（命中保持相对引用）再查全局 `assetsDir`（命中重写为 `/assets/...`）；未命中返回 `null` 由调用方报错。
- **process 阶段**：插件经 `api.hook.beforeProcess.tap()` / `afterProcess.tap()` 遍历并改写 `Asset[]`（如压缩）。

## Markdown 渲染

`markdown.ts` 以 unified 构建管线：

```
remark-parse → remark-gfm → remark-math → remark-rehype(allowDangerousHtml)
  → rehype-raw → rehype-slug → 目录收集 → 资源引用解析
  → rehype-katex → @shikijs/rehype（构建时高亮）→ rehype-stringify
```

- **代码高亮**：shiki 动态加载语言集合，模块级单例复用；`markdown.highlight`/`clientHighlight` 可开关。
- **目录**：收集 h1–h3 生成 `toc`（跳过 GFM 脚注区块）。
- **KaTeX**：`markdown.katex` 开关。

## 公共 API（`index.ts`）

- `build(options)` — 主构建入口。
- `createHooks()` — 构建阶段 hook 集。
- `loadSiteConfig` / `defineConfig` — 配置加载与定义。
- `loadTheme` / `renderPage` / `resolveThemeDir` — 主题相关。
- `renderMarkdown` — 内置默认 Markdown 渲染（可作为默认 renderer）。
- `RendererRegistryImpl` — renderer 注册表实现。
- `parseCategories` / `buildCategoryTree` / `categoryPathToUrl` — 分类工具。
- `scanAssets` / `resolveAssetRef` — 资源工具。
- `SiteImpl` / `CollectionImpl` / `AsyncHookImpl` — 实现类。
- 插件类型：`GeneratorAPI` / `HookAPI` / `RendererAPI` / `PluginBase`。
