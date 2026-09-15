import fs from "node:fs";
import path from "node:path";
import { toPosixPath } from "../path.js";
// TODO: 使用 mime 判断？
const FILETYPES = {
    "markdown": ["md"],
    "image": ["jpg"],
};
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
                    type: getFileType(entry.name)
                });
            }
        }
    };
    walk(contentRoot);
    return files;
}
function getFileType(basename) {
    for (const type in FILETYPES) {
        const s = basename.split('.');
        const ext = s[s.length - 1] || "";
        if (ext === "")
            return "unknow";
        if (FILETYPES[type]?.indexOf(ext) !== -1) {
            return type;
        }
    }
    return "unknow";
}
export default function seqRead(root, cwd) {
    return scanContent(root, cwd);
}
//# sourceMappingURL=read.js.map