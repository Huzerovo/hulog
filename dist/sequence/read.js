import fs from "node:fs";
import path from "node:path";
import { toPosixPath } from "../path.js";
function scanContent(contentRoot, projectRoot) {
    if (!fs.existsSync(contentRoot)) {
        throw new Error(`内容目录不存在: ${contentRoot}`);
    }
    const files = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const abs = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(abs);
            }
            else if (entry.isFile()) {
                const isMd = /\.md$/i.test(entry.name);
                files.push({
                    path: toPosixPath(path.relative(projectRoot, abs)),
                    absolutePath: abs,
                    isAsset: !isMd,
                });
            }
        }
    };
    walk(contentRoot);
    return files;
}
export default function seqRead(root, cwd) {
    return scanContent(root, cwd);
}
//# sourceMappingURL=read.js.map