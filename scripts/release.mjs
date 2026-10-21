#!/usr/bin/env node
/**
 * 版本发布：同步更新 @hulog/core 与 @hulog/cli 的 version，并生成发布提交。
 *
 * 用法：
 *   npm run release:patch           # 0.1.5 → 0.1.6
 *   npm run release:minor           # 0.1.5 → 0.2.0
 *   npm run release:major           # 0.1.5 → 1.0.0
 *   npm run release -- 1.2.3        # 指定版本（须大于当前版本）
 *   npm run release -- patch --dry-run     # 只打印，不修改
 *   npm run release -- patch --no-commit   # 修改并 add，不提交
 *   npm run release -- patch --tag         # 额外打 vX.Y.Z 轻量 tag
 *   npm run release -- 1.2.3 --force       # 允许非递增版本
 *
 * 注意：只提交两个 package.json（不带上其它已暂存改动）。
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_FILES = ["packages/core/package.json", "packages/cli/package.json"];
const USAGE = `用法: npm run release -- <patch|minor|major|x.y.z> [选项]

选项:
  --dry-run    只打印将要发生的变更，不写文件/不提交
  --no-commit  只修改并 git add，不生成提交
  --tag        提交后打轻量 tag（v<version>）
  --force      允许指定版本不大于当前版本
  --help       显示本帮助`;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/** 解析 x.y.z → { major, minor, patch } */
function parseVersion(value) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  return m ? { major: +m[1], minor: +m[2], patch: +m[3] } : null;
}

/** 版本比较：a > b 返回正数 */
function compareVersion(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) fail(`非法版本号: ${!pa ? a : b}`);
  return pa.major - pb.major || pa.minor - pb.minor || pa.patch - pb.patch;
}

function bumpVersion(current, kind) {
  const v = parseVersion(current);
  if (!v) fail(`当前版本号非法: ${current}`);
  if (kind === "patch") v.patch += 1;
  else if (kind === "minor") {
    v.minor += 1;
    v.patch = 0;
  } else if (kind === "major") {
    v.major += 1;
    v.minor = 0;
    v.patch = 0;
  }
  return `${v.major}.${v.minor}.${v.patch}`;
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, stdio: "inherit" });
}

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("-")));
const targets = argv.filter((a) => !a.startsWith("-"));
const knownFlags = new Set(["--dry-run", "--no-commit", "--tag", "--force", "--help", "-h"]);
for (const flag of flags) {
  if (!knownFlags.has(flag)) fail(`未知选项: ${flag}\n\n${USAGE}`);
}
if (flags.has("--help") || flags.has("-h") || targets.length === 0) {
  console.log(USAGE);
  process.exit(0);
}
if (targets.length > 1) fail(`参数过多: ${targets.join(" ")}\n\n${USAGE}`);

const target = targets[0];
const dryRun = flags.has("--dry-run");
const noCommit = flags.has("--no-commit");
const tag = flags.has("--tag");
const force = flags.has("--force");

// 读取并校验两个包
const packages = PACKAGE_FILES.map((rel) => {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) fail(`未找到文件: ${rel}`);
  const json = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (typeof json.version !== "string") fail(`${rel} 缺少 version 字段`);
  return { rel, abs, json };
});
const versions = [...new Set(packages.map((p) => p.json.version))];
if (versions.length !== 1) {
  fail(`两个包的版本不一致：${packages.map((p) => `${p.rel}=${p.json.version}`).join("，")}\n请先手动对齐版本`);
}
const current = versions[0];

// 计算目标版本
let next;
if (target === "patch" || target === "minor" || target === "major") {
  next = bumpVersion(current, target);
} else if (parseVersion(target)) {
  next = target;
} else {
  fail(`无法识别的目标版本: ${target}\n\n${USAGE}`);
}
if (!force && compareVersion(next, current) <= 0) {
  fail(`目标版本 ${next} 不大于当前版本 ${current}（如需强制使用 --force）`);
}

console.log(`版本: ${current} → ${next}`);
console.log(`文件: ${PACKAGE_FILES.join(", ")}`);
console.log(`提交: chore: 发布 ${next}${tag ? `（tag: v${next}）` : ""}`);
if (dryRun) {
  console.log("（--dry-run：未修改任何文件）");
  process.exit(0);
}

// 写回（保持两空格缩进与键顺序）
for (const pkg of packages) {
  pkg.json.version = next;
  fs.writeFileSync(pkg.abs, JSON.stringify(pkg.json, null, 2) + "\n");
}

git(["add", ...PACKAGE_FILES]);
if (noCommit) {
  console.log(`✓ 已更新并暂存（--no-commit）`);
  process.exit(0);
}

git([
  "commit",
  "-m",
  `chore: 发布 ${next}`,
  "-m",
  `- @hulog/cli / @hulog/core 版本号统一升至 ${next}`,
  "--",
  ...PACKAGE_FILES,
]);
if (tag) {
  git(["tag", `v${next}`]);
  console.log(`✓ 已创建 tag: v${next}`);
}
console.log(`✓ 已提交: chore: 发布 ${next}`);
