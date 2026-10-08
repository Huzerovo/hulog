/**
 * 路径工具
 */
/** 将 Windows 反斜杠分隔符归一化为 POSIX 正斜杠（URL 与跨平台相对路径使用） */
export function toPosixPath(p) {
    return p.replace(/\\/g, "/");
}
//# sourceMappingURL=path.js.map