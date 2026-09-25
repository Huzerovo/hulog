import fs from "node:fs";
import path from "node:path";
import { Logger } from "@hulog/core";
export function cleanCmd() {
    const logger = Logger.getLogger("cli:clean");
    const dist = path.join(process.cwd(), "dist");
    if (fs.existsSync(dist)) {
        fs.rmSync(dist, { recursive: true, force: true });
        logger.info("已清理 dist/");
    }
    else {
        logger.info("dist/ 不存在，无需清理");
    }
}
//# sourceMappingURL=clean.js.map