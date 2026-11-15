# @hulog/cli

hulog 静态博客生成器的命令行工具：构建站点、启动开发服务器、管理文章，以及把单个 Markdown 渲染为自包含 HTML。

> 构建逻辑由 [`@hulog/core`](https://www.npmjs.com/package/@hulog/core) 提供，CLI 仅做薄封装。

## 安装

要求 Node.js >= 22.12.0。

```bash
npm install -D @hulog/cli
# 或全局安装
npm install -g @hulog/cli
```

## 快速开始

```bash
mkdir my-blog && cd my-blog
npm init -y
npm install -D @hulog/cli

# 生成 blog.config.ts、theme.config.ts 与内容目录
npx hulog init

# 将主题放入 themes/<name>/，或在 blog.config.ts 中指定已安装的主题包
npx hulog dev
```

开发服务器默认监听 `http://localhost:3000`，生产构建输出到 `dist/`。

## 命令

| 命令 | 说明 |
|------|------|
| `hulog init [dir]` | 创建站点目录、默认配置与示例页面 |
| `hulog dev` | 启动开发服务器（构建 + 静态服务 + WebSocket 热重载） |
| `hulog build` | 生产构建到 `dist/` |
| `hulog clean` | 删除 `dist/` |
| `hulog new <title>` | 新建草稿（默认写入 `content/drafts/`） |
| `hulog publish [slug]` | 发布草稿到集合（补 `date`、移除 `draft`） |
| `hulog render <file.md>` | 将单个 Markdown 渲染为自包含 HTML |

常用参数：

```bash
hulog dev -p 4000 -b ./my-blog      # 端口 / 站点根目录
hulog build -b ./my-blog
hulog new "Hello World" -c posts    # 指定集合
hulog new "Hello World" --no-draft  # 直接创建到集合
hulog publish hello-world           # 发布指定草稿
hulog publish --all --collection posts
hulog render notes.md -o notes.html -b . --layout post
```

全局 `-v/--verbose`、`-q/--quiet` 分别输出 debug / warn 级别日志。

## 配置

站点根目录的 `blog.config.ts` 定义站点信息与内容集合：

```ts
export default {
  siteTitle: "My Blog",
  theme: "default",
  contentDir: "content",
  assetsDir: "assets",
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
};
```

常见目录：

```text
content/posts/   文章
content/pages/   独立页面
content/drafts/  草稿
assets/          全局资源
public/          原样复制到 dist/
themes/          本地主题
```

## 单文件渲染

`render` 会复用站点配置与主题，把纯 Markdown 输出为自包含 HTML（CSS、本地 JS 与图片内联）：

```bash
hulog render ./notes.md -b . -o ./notes.html
```

## 链接

- 仓库：https://github.com/Huzerovo/hulog
- 问题反馈：https://github.com/Huzerovo/hulog/issues
- 许可证：MIT
