import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { loadSiteConfig } from "../src/config.js";

const tmpDirs: string[] = [];
function tmpRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hulog-cfg-"));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

test("loadSiteConfig: 缺省值补全（含 virtualPages）", async () => {
  const root = tmpRoot();
  fs.writeFileSync(
    path.join(root, "blog.config.ts"),
    `export default { siteTitle: "t", theme: "x", collections: [] };`,
  );
  const cfg = await loadSiteConfig(root);
  assert.equal(cfg.contentDir, "content");
  assert.equal(cfg.assetsDir, "assets");
  assert.equal(cfg.themeAssetsMode, "merge");
  assert.equal(cfg.perPage, 10);
  assert.equal(cfg.renderDraft, false);
  assert.equal(cfg.archivesDir, "archives");
  assert.equal(cfg.paginationDir, "page");
  assert.equal(cfg.language, "zh-CN");
  assert.equal(cfg.pluginsDir, "plugins");
  assert.deepEqual(cfg.virtualPages, []);
});

test("loadSiteConfig: 用户配置覆盖默认值", async () => {
  const root = tmpRoot();
  fs.writeFileSync(
    path.join(root, "blog.config.ts"),
    `export default {
      siteTitle: "t",
      theme: "x",
      collections: [],
      perPage: 5,
      assetsDir: "static",
      virtualPages: [{ id: "v", url: "/v", title: "V", layout: "page" }],
    };`,
  );
  const cfg = await loadSiteConfig(root);
  assert.equal(cfg.perPage, 5);
  assert.equal(cfg.assetsDir, "static");
  assert.equal(cfg.virtualPages.length, 1);
});

test("loadSiteConfig: 缺少配置文件抛错", async () => {
  const root = tmpRoot();
  await assert.rejects(() => loadSiteConfig(root), /未找到配置文件/);
});
