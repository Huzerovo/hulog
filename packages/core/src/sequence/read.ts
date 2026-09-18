import fs from "node:fs";
import path from "node:path";
import { toPosixPath } from "../path.js";
import type { FileEntry } from "../types/sequence.js";

// TODO: 使用 mime 判断？
const FILETYPES: Record<string, string[]> = {
  "markdown": ["md"],
  "image": ["jpg"],
};

const POSTS_TYPE = ["markdown"];
const ASSETS_TYPE = ["image"];

export function isPosts(file: FileEntry) {
  return POSTS_TYPE.indexOf(file.type) !== -1;
}

export function isAssets(file: FileEntry) {
  return !(ASSETS_TYPE.indexOf(file.type) === -1);
}

export default function seqRead(contentRoot: string, projectRoot: string): FileEntry[] {
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
        const ft = getFileType(entry.name);
        const isPost = POSTS_TYPE.indexOf(ft) !== -1;

        files.push({
          path: toPosixPath(path.relative(projectRoot, abs)),
          absolutePath: abs,
          type: ft,
          isAsset: !isPost,
          // 仅资源文件拥有
          isExclusive: isPost ? undefined : true,
        });
      }
    }
  };
  walk(contentRoot);
  return files;
}

function getFileType(basename: string): string {
  for (const type in FILETYPES) {
    const s = basename.split('.');
    const ext = s[s.length - 1] || "";
    if (ext === "") return "unknow";
    if (FILETYPES[type]?.indexOf(ext) !== -1) {
      return type;
    }
  }
  return "unknow";
}
