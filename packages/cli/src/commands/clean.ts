import fs from "node:fs";
import path from "node:path";
import { Logger } from "@hulog/core";

export interface CleanOptions {
  /** 网站根目录，默认当前目录 */
  base?: string;
}

export function cleanCmd(opts: CleanOptions = {}) {
  const logger = Logger.getLogger("cli:clean");
  const dist = path.join(opts.base ?? process.cwd(), "dist");
  if (fs.existsSync(dist)) {
    fs.rmSync(dist, { recursive: true, force: true });
    logger.info("已清理 dist/");
  } else {
    logger.info("dist/ 不存在，无需清理");
  }
}
