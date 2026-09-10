import fs from "node:fs";
import path from "node:path";
import { toPosixPath } from "../path.js";
import type { FileEntry } from "../types/sequence.js";

const FILETYPES: Record<string, string[]> = {
  "markdown": ["md"],
  "image": ["jpg"],
};

function scanContent(contentRoot: string, projectRoot: string): FileEntry[] {
  if (!fs.existsSync(contentRoot)) {
    throw new Error(`内容目录不存在: ${contentRoot}`);
  }
  const files: FileEntry[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile()) {
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

function getFileType(basename: string): string {
  for (const type in Object.keys(FILETYPES)) {
    const s = basename.split('.');
    const ext = s[s.length - 1] || "";
    if (ext === "") return "unknow";
    if (FILETYPES[type]?.indexOf(ext) !== -1) {
      return type;
    }
  }
  return "unknow";
}

export default function seqRead(root: string, cwd: string): FileEntry[] {
  return scanContent(root, cwd);
}
