import type { FileEntry } from "../types/sequence.js";
export declare function isPosts(file: FileEntry): boolean;
export declare function isAssets(file: FileEntry): boolean;
export default function seqRead(contentRoot: string, projectRoot: string): FileEntry[];
