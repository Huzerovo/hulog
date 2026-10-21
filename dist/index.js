#!/usr/bin/env node
import { Command } from "commander";
import { initCmd } from "./commands/init.js";
import { buildCmd } from "./commands/build.js";
import { cleanCmd } from "./commands/clean.js";
import { newCmd } from "./commands/new.js";
import { publishCmd } from "./commands/publish.js";
import { devCmd } from "./commands/dev.js";
import { renderCmd } from "./commands/render.js";
import { run } from "./run.js";
const program = new Command();
program
    .name(process.title)
    .description("静态博客生成器（Hexo 内容模型 + TSX 主题）")
    .version("0.1.0")
    .option("-v, --verbose", "输出 debug 级日志")
    .option("-q, --quiet", "仅输出 warn/error 日志");
// 全局日志级别（作用于 core/cli 的 Logger，需在命令创建 Logger 前生效）
program.hook("preAction", () => {
    const { verbose, quiet } = program.opts();
    if (verbose)
        process.env.HULOG_LOG_LEVEL = "debug";
    else if (quiet)
        process.env.HULOG_LOG_LEVEL = "warn";
});
program
    .command("init")
    .description("创建新站点")
    .argument("[dir]", "目标目录，默认当前目录", ".")
    .action((dir) => run("init", () => initCmd(dir)));
program
    .command("dev")
    .description("启动开发服务器（热重载）")
    .option("-p, --port <port>", "端口", "3000")
    .option("-b, --base <path>", "网站根目录", process.cwd())
    .action((opts) => run("dev", () => devCmd({ port: Number(opts.port), base: opts.base })));
program
    .command("build")
    .description("生产构建")
    .option("-b, --base <path>", "网站根目录", process.cwd())
    .action((opts) => run("build", () => buildCmd({ base: opts.base })));
program
    .command("render")
    .description("将单个 Markdown 文件渲染为自包含 HTML（复用站点主题）")
    .argument("<file>", "输入 markdown 文件")
    .option("-o, --out <file>", "输出 HTML 路径（默认与输入同名 .html）")
    .option("-t, --theme <name>", "主题名或路径（缺省读取站点配置）")
    .option("-b, --base <path>", "站点根目录（定位 themes/ 与配置）", process.cwd())
    .option("--layout <name>", "布局名", "post")
    .option("--title <title>", "覆盖标题（缺省取正文首个 H1）")
    .action((file, opts) => run("render", () => renderCmd({
    file,
    out: opts.out,
    theme: opts.theme,
    base: opts.base,
    layout: opts.layout,
    title: opts.title,
})));
program
    .command("clean")
    .description("清理输出目录")
    .option("-b, --base <path>", "网站根目录", process.cwd())
    .action((opts) => run("clean", () => cleanCmd({ base: opts.base })));
program
    .command("new")
    .description("创建新文章（默认写入草稿区）")
    .argument("<title>", "文章标题")
    .option("-c, --collection <name>", "目标集合")
    .option("--no-draft", "直接创建到集合（不写入草稿区）")
    .action((title, opts) => run("new", () => newCmd({ title, draft: opts.draft, collection: opts.collection })));
program
    .command("publish")
    .description("发布草稿：移动到目标集合，自动补 date，移除 draft 标记")
    .argument("[slug]", "草稿 slug；省略时配合 --all")
    .option("--all", "发布全部草稿")
    .option("--no-date", "不自动补 date")
    .option("--collection <name>", "目标集合，默认 posts")
    .action((slug, opts) => run("publish", () => publishCmd({ slug, all: opts.all, autoDate: opts.date, collection: opts.collection })));
program.parse();
//# sourceMappingURL=index.js.map