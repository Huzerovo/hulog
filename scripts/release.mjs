#!/usr/bin/env node
/**
 * 版本发布：独立更新 @hulog/core 或 @hulog/cli 的 version，并生成发布提交。
 * hulog 根包不参与发布。
 *
 * 当前开发占位版本 0.0.0-development 会以 0.0.0 为基线递增：
 *   npm run release:core -- patch  # 0.0.0-development → 0.0.1
 *   npm run release:core -- minor  # 0.0.0-development → 0.1.0
 *   npm run release:core -- major  # 0.0.0-development → 1.0.0
 *
 * 用法：
 *   npm run release:core -- patch
 *   npm run release:cli  -- minor
 *   npm run release:core -- 0.2.0
 *   npm run release:cli  -- 0.1.6
 *   npm run release:core -- patch --dry-run
 *   npm run release:core -- patch --no-commit
 *   npm run release:core -- patch --tag
 *   npm run release:cli  -- 0.1.6 --force
 *
 * 注意：
 * - 每次只处理一个包，只提交对应 package.json，不带上其它已暂存改动。
 * - --tag 创建形如 core@0.2.0 / cli@0.1.6 的轻量 tag。
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = {
  core: { name: "@hulog/core", file: "packages/core/package.json" },
  cli: { name: "@hulog/cli", file: "packages/cli/package.json" },
};
const PLACEHOLDER_VERSION = "0.0.0-development";
const PLACEHOLDER_BASE = "0.0.0";
const USAGE = `用法:
  npm run release:core -- <patch|minor|major|x.y.z> [选项]
  npm run release:cli  -- <patch|minor|major|x.y.z> [选项]

也可直接:
  node scripts/release.mjs <core|cli> <patch|minor|major|x.y.z> [选项]

选项:
  --dry-run    只打印将要发生的变更，不写文件/不提交
  --no-commit  只修改并 git add，不生成提交
  --tag        提交后打轻量 tag（<包名>@<版本>，如 core@0.2.0）
  --force      允许指定版本不大于当前版本
  --help       显示本帮助

说明:
  - 每次只更新一个包，hulog 根包不参与发布。
  - 开发占位版本 ${PLACEHOLDER_VERSION} 按 ${PLACEHOLDER_BASE} 作为基线递增。`;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/** 解析 x.y.z → { major, minor, patch } */
function parseVersion(value) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  return m ? { major: +m[1], minor: +m[2], patch: +m[3] } : null;
}

/** 占位开发版本按 0.0.0 计算，其他版本原样参与比较 */
function baseVersion(value) {
  return value === PLACEHOLDER_VERSION ? PLACEHOLDER_BASE : value;
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
if (targets.length !== 2) {
  fail(`需要指定包和版本，例如 core patch 或 cli 0.1.6\n\n${USAGE}`);
}

const [packageKey, target] = targets;
const packageInfo = PACKAGES[packageKey];
if (!packageInfo) {
  fail(`未知包: ${packageKey}\n可用包: ${Object.keys(PACKAGES).join(" / ")}`);
}

const dryRun = flags.has("--dry-run");
const noCommit = flags.has("--no-commit");
const tag = flags.has("--tag");
const force = flags.has("--force");

// 读取并校验目标包
const abs = path.join(ROOT, packageInfo.file);
if (!fs.existsSync(abs)) fail(`未找到文件: ${packageInfo.file}`);
const json = JSON.parse(fs.readFileSync(abs, "utf8"));
if (json.name !== packageInfo.name) {
  fail(`${packageInfo.file} 的 name 为 "${json.name}"，预期 "${packageInfo.name}"`);
}
if (typeof json.version !== "string") {
  fail(`${packageInfo.file} 缺少 version 字段`);
}

const currentRaw = json.version;
const current = baseVersion(currentRaw);
if (!parseVersion(current)) {
  fail(`当前版本号非法: ${currentRaw}`);
}

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

const currentLabel =
  currentRaw === current ? current : `${currentRaw}（按 ${current} 递增）`;
const tagName = `${packageKey}@${next}`;
console.log(`包: ${packageInfo.name}`);
console.log(`版本: ${currentLabel} → ${next}`);
console.log(`文件: ${packageInfo.file}`);
console.log(`提交: chore(${packageKey}): 发布 ${next}${tag ? `（tag: ${tagName}）` : ""}`);
if (dryRun) {
  console.log("（--dry-run：未修改任何文件）");
  process.exit(0);
}

// 写回（保持两空格缩进与键顺序）
json.version = next;
fs.writeFileSync(abs, JSON.stringify(json, null, 2) + "\n");

git(["add", packageInfo.file]);
if (noCommit) {
  console.log("✓ 已更新并暂存（--no-commit）");
  process.exit(0);
}

git([
  "commit",
  "-m",
  `chore(${packageKey}): 发布 ${next}`,
  "-m",
  `- ${packageInfo.name} 版本升至 ${next}`,
  "--",
  packageInfo.file,
]);
if (tag) {
  git(["tag", tagName]);
  console.log(`✓ 已创建 tag: ${tagName}`);
}
console.log(`✓ 已提交: chore(${packageKey}): 发布 ${next}`);
