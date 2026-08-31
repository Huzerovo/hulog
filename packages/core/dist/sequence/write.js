import fs from "node:fs";
import path from "node:path";
function writeUrl(distDir, url, content) {
    const rel = url.replace(/^\/+/, "");
    // 以 "/" 结尾的是页面 URL（写 index.html）；否则是资源文件路径（直接写）
    const out = url.endsWith("/")
        ? path.join(distDir, rel, "index.html")
        : path.join(distDir, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, content);
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