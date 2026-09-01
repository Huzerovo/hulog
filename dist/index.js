#!/usr/bin/env node
import { Command } from "commander";
import { initCmd } from "./commands/init.js";
import { buildCmd } from "./commands/build.js";
import { cleanCmd } from "./commands/clean.js";
import { newCmd } from "./commands/new.js";
import { publishCmd } from "./commands/publish.js";
import { devCmd } from "./commands/dev.js";
const program = new Command();
program
    .name(process.title)
    .description("静态博客生成器（Hexo 内容模型 + TSX 主题）")
    .version("0.1.0");
program
    .command("init")
    .description("创建新站点")
    .argument("[dir]", "目标目录，默认当前目录", ".")
    .action(initCmd);
program
    .command("dev")
    .description("启动开发服务器（热重载）")
    .option("-p, --port <port>", "端口", "3000")
    .option("-b, --base <path>", "网站根目录", process.cwd())
    .action((opts) => devCmd({ port: Number(opts.port), base: opts.base }));
program
    .command("build")
    .description("生产构建")
    .action(buildCmd);
program
    .command("clean")
    .description("清理输出目录")
    .action(cleanCmd);
program
    .command("new")
    .description("创建新文章（默认写入草稿区）")
    .argument("<title>", "文章标题")
    .option("-c, --collection <name>", "目标集合")
    .action((title, opts) => newCmd({ title, draft: opts.draft, collection: opts.collection }));
program
    .command("publish")
    .description("发布草稿：移动到目标集合，自动补 date，移除 draft 标记")
    .argument("[slug]", "草稿 slug；省略时配合 --all")
    .option("--all", "发布全部草稿")
    .option("--no-date", "不自动补 date")
    .option("--collection <name>", "目标集合，默认 posts")
    .action((slug, opts) => publishCmd({ slug, all: opts.all, autoDate: opts.date, collection: opts.collection }));
program.parse();
//# sourceMappingURL=index.js.map