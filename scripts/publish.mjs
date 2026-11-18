#!/usr/bin/env node
/**
 * 发布 @hulog/core 与 @hulog/cli 到 npm。
 *
 * 流程：
 * 1. 校验两个包版本，拒绝开发占位版本
 * 2. 校验 CLI 的 @hulog/core 依赖已经由 release:cli 更新为 ^<core version>
 * 3. 在仓库根执行 build（core + cli）
 * 4. 先发布 @hulog/core，再发布 @hulog/cli
 *
 * 用法：
 *   npm run publish:packages
 *   npm run publish:packages -- --dry-run
 *   npm run publish:packages -- --tag next
 *   npm run publish:packages -- --otp 123456
 *
 * 注意：hulog 根包是 private，不发布；只发布 packages/core 与 packages/cli。
 * 其余参数会透传给 npm publish；默认附加 --access public。
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
const CORE_DIR = path.join(ROOT, "packages/core");
const CLI_DIR = path.join(ROOT, "packages/cli");
const CORE_FILE = path.join(CORE_DIR, "package.json");
const CLI_FILE = path.join(CLI_DIR, "package.json");
const PLACEHOLDER_VERSION = "0.0.0-development";
const USAGE = `用法: npm run publish:packages -- [npm publish 选项]

说明:
  hulog 根包不发布，只发布 packages/core 与 packages/cli。
  1. 校验 @hulog/core / @hulog/cli 版本
  2. 校验 CLI 的 @hulog/core 依赖为 ^<core version>
  3. 执行根目录 build（core + cli）
  4. 跳过 npm 上已存在的版本，依次发布 core、cli

示例:
  npm run publish:packages
  npm run publish:packages -- --dry-run
  npm run publish:packages -- --tag next
  npm run publish:packages -- --otp 123456

其余参数会透传给 npm publish；默认附加 --access public。`;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function runNpm(args, cwd) {
  execFileSync(NPM, args, { cwd, stdio: "inherit" });
}

/** 查询 npm 上是否已存在指定版本 */
function isPublished(name, version) {
  try {
    const out = execFileSync(NPM, ["view", `${name}@${version}`, "version", "--json"], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
    return out !== "";
  } catch {
    return false;
  }
}

const rawArgs = process.argv.slice(2);
if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
  console.log(USAGE);
  process.exit(0);
}

const dryRun = rawArgs.includes("--dry-run");
const publishArgs = [...rawArgs];
if (!publishArgs.some((a) => a === "--access" || a.startsWith("--access="))) {
  publishArgs.push("--access", "public");
}

const core = readJson(CORE_FILE);
const cli = readJson(CLI_FILE);

const packages = [
  { label: "core", json: core },
  { label: "cli", json: cli },
];

for (const pkg of packages) {
  if (typeof pkg.json.version !== "string") {
    fail(`${pkg.json.name ?? pkg.label} 缺少 version 字段`);
  }
  if (pkg.json.version === PLACEHOLDER_VERSION) {
    fail(
      `${pkg.json.name} 仍为开发占位版本 ${PLACEHOLDER_VERSION}\n` +
        `请先运行 npm run release:${pkg.label} -- <patch|minor|major|x.y.z>`,
    );
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.json.version)) {
    fail(`${pkg.json.name} 的版本号非法: ${pkg.json.version}`);
  }
}

const expectedCoreDep = `^${core.version}`;
const coreDep = cli.dependencies?.[core.name];
if (coreDep !== expectedCoreDep) {
  fail(
    `${cli.name} 的 ${core.name} 依赖为 "${coreDep ?? "(未设置)"}"，预期 "${expectedCoreDep}"\n` +
      `请先运行 npm run release:cli -- <patch|minor|major|x.y.z>`,
  );
}

const corePublished = isPublished(core.name, core.version);
const cliPublished = isPublished(cli.name, cli.version);

if (corePublished) {
  console.log(`${core.name}@${core.version} 已存在于 npm，跳过`);
}
if (cliPublished) {
  console.log(`${cli.name}@${cli.version} 已存在于 npm，跳过`);
}
if (corePublished && cliPublished) {
  console.log("两个版本均已发布，无需操作");
  process.exit(0);
}

if (!dryRun) {
  try {
    execFileSync(NPM, ["whoami"], { cwd: ROOT, stdio: "ignore" });
  } catch {
    fail("尚未登录 npm，请先运行 npm login");
  }
}

console.log(`\n发布 ${core.name}@${core.version}`);
console.log(`发布 ${cli.name}@${cli.version}`);
console.log(`CLI 依赖 ${core.name}@${coreDep}`);

console.log("\n[1/3] 构建 core + cli");
runNpm(["run", "build"], ROOT);

if (!corePublished) {
  console.log(`\n[2/3] 发布 ${core.name}@${core.version}`);
  runNpm(["publish", ...publishArgs], CORE_DIR);
} else {
  console.log(`\n[2/3] 跳过 ${core.name}@${core.version}（已发布）`);
}

if (!cliPublished) {
  console.log(`\n[3/3] 发布 ${cli.name}@${cli.version}`);
  runNpm(["publish", ...publishArgs], CLI_DIR);
} else {
  console.log(`\n[3/3] 跳过 ${cli.name}@${cli.version}（已发布）`);
}

console.log("\n✓ 发布完成");
