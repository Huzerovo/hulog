import fs from "node:fs";
import path from "node:path";
import { loadSiteConfig } from "@hulog/core";

export interface NewOptions {
  title: string;
  collection?: string;
}

/** 标题 → slug（小写、空格转连字符、保留中文字符） */
export function slugify(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "")
    .replace(/-+/g, "-");
  return s || "untitled";
}

export async function newCmd(opts: NewOptions) {
  const cwd = process.cwd();
  const config = await loadSiteConfig(cwd);
  const draftByDefault = config.cli?.newPostDraft !== false;
  const contentRoot = path.join(cwd, config.content?.rootDir ?? "content");

  // 目标集合与目录
  let collectionName = opts.collection;
  if (!collectionName) {
    if (draftByDefault) {
      // 草稿区不属于集合，目标目录为 drafts/
      const draftsDir = path.join(contentRoot, "drafts");
      fs.mkdirSync(draftsDir, { recursive: true });
      const file = path.join(draftsDir, slugify(opts.title) + ".md");
      writeDraft(file, opts.title);
      console.log(`✓ 草稿已创建: ${path.relative(cwd, file)}`);
      return;
    }
    // 直接发布：默认第一个集合
    collectionName = config.collections[0]?.name;
    if (!collectionName) {
      console.error("未配置集合，无法创建文章");
      process.exit(1);
    }
  }

  const col = config.collections.find((c) => c.name === collectionName);
  if (!col) {
    console.error(`集合不存在: ${collectionName}`);
    process.exit(1);
  }
  const dir = path.join(contentRoot, col.sourceDir);
  fs.mkdirSync(dir, { recursive: true });
  const slug = slugify(opts.title);
  const file = path.join(dir, slug + ".md");
  if (fs.existsSync(file)) {
    console.error(`文件已存在: ${path.relative(cwd, file)}`);
    process.exit(1);
  }
  const fm: string[] = [`title: ${JSON.stringify(opts.title)}`];
  if (col.sortBy === "date") {
    fm.push(`date: ${new Date().toISOString().slice(0, 10)}`);
  }
  fs.writeFileSync(
    file,
    `---\n${fm.join("\n")}\n---\n\n`,
  );
  console.log(`✓ 文章已创建: ${path.relative(cwd, file)}`);
}

function writeDraft(file: string, title: string) {
  fs.writeFileSync(
    file,
    `---\ntitle: ${JSON.stringify(title)}\n---\n\n`,
  );
}
