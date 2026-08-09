import fs from "node:fs";
import path from "node:path";

export function cleanCmd() {
  const dist = path.join(process.cwd(), "dist");
  if (fs.existsSync(dist)) {
    fs.rmSync(dist, { recursive: true, force: true });
    console.log("✓ 已清理 dist/");
  } else {
    console.log("dist/ 不存在，无需清理");
  }
}
