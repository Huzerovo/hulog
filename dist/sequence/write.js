import fs from "node:fs";
import path from "node:path";
function writeUrl(distDir, url, content) {
    // URL 用于浏览器访问，中文等字符会被百分号编码；写盘时须还原为原始字符
    const pathname = url.split(/[?#]/, 1)[0] ?? url;
    const rel = decodeUrlPath(pathname).replace(/^\/+/, "");
    // 以 "/" 结尾的是页面 URL（写 index.html）；否则是资源文件路径（直接写）
    const out = pathname.endsWith("/")
        ? path.join(distDir, rel, "index.html")
        : path.join(distDir, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, content);
}
/** URL 路径 → 文件系统路径：逐段解码百分号编码，非法序列原样保留 */
function decodeUrlPath(pathname) {
    return pathname
        .split("/")
        .map((seg) => {
        try {
            return decodeURIComponent(seg);
        }
        catch {
            return seg;
        }
    })
        .join("/");
}
export function seqWrite(dist, results, assets) {
    for (const { page, html } of results) {
        writeUrl(dist, page.url, html);
    }
    for (const asset of assets) {
        writeUrl(dist, asset.url, asset.buffer);
    }
}
//# sourceMappingURL=write.js.map