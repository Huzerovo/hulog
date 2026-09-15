import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { loadSiteConfig } from "@hulog/core";
import { slugify } from "./new.js";
export async function publishCmd(opts) {
    const cwd = process.cwd();
    const config = await loadSiteConfig(cwd);
    const contentRoot = path.join(cwd, config.contentDir ?? "content");
    const draftsDir = path.join(contentRoot, "drafts");
    if (!fs.existsSync(draftsDir)) {
        console.error("草稿区不存在: content/drafts/");
        process.exit(1);
    }
    // 目标集合
    const targetName = opts.collection ?? "posts";
    const col = config.collections.find((c) => c.name === targetName);
    if (!col) {
        console.error(`目标集合 "${targetName}" 不存在（可用 --collection 指定，当前集合: ${config.collections.map((c) => c.name).join(", ")}）`);
        process.exit(1);
    }
    const targetDir = path.join(contentRoot, col.sourceDir);
    // 收集草稿文件
    const drafts = fs
        .readdirSync(draftsDir, { withFileTypes: true })
        .filter((e) => e.isFile() && /\.md$/i.test(e.name))
        .map((e) => e.name);
    let targets;
    if (opts.all) {
        targets = drafts;
    }
    else if (opts.slug) {
        const slug = slugify(opts.slug);
        const match = drafts.find((f) => f.replace(/\.md$/i, "") === slug);
        if (!match) {
            console.error(`草稿不存在: ${slug}（可用 --all 发布全部）`);
            process.exit(1);
        }
        targets = [match];
    }
    else {
        console.error("请指定草稿 slug 或使用 --all");
        process.exit(1);
    }
    if (targets.length === 0) {
        console.log("草稿区为空，无内容可发布");
        return;
    }
    for (const file of targets) {
        const src = path.join(draftsDir, file);
        const slug = file.replace(/\.md$/i, "");
        const dest = path.join(targetDir, file);
        if (fs.existsSync(dest)) {
            console.error(`✗ 冲突：目标已存在同名文件，已跳过: ${path.relative(cwd, dest)}`);
            continue;
        }
        // 处理 front-matter：补 date、去 draft
        const raw = fs.readFileSync(src, "utf8");
        const { data, content } = matter(raw);
        if (opts.autoDate !== false && !data.date) {
            data.date = new Date().toISOString().slice(0, 10);
        }
        delete data.draft;
        const out = matter.stringify(content, data);
        fs.writeFileSync(dest, out);
        fs.rmSync(src);
        // 移动同名专属资源目录
        const assetDir = path.join(draftsDir, slug);
        if (fs.existsSync(assetDir)) {
            fs.renameSync(assetDir, path.join(targetDir, slug));
        }
        console.log(`✓ 已发布: ${path.relative(cwd, dest)}`);
    }
}
//# sourceMappingURL=publish.js.map