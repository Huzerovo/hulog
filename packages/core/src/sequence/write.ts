import fs from "node:fs";
import path from "node:path";
import { RenderResult } from "../types/sequence.js";
import { Asset } from "../types/asset.js";

// FIXME 需要根据 layout, url 等综合判断，传入参数为 page
function writeUrl(distDir: string, url: string, content: string | Buffer) {

  const rel = url.replace(/^\/+/, "");
  // 以 "/" 结尾的是页面 URL（写 index.html）；否则是资源文件路径（直接写）
  const out = url.endsWith("/")
    ? path.join(distDir, rel, "index.html")
    : path.join(distDir, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content);
  console.log(`Write url: ${url}`)
}


export function seqWrite(dist: string, results: RenderResult[], assets: Asset[]) {
  for (const { page, html } of results) {
    // FIXME 临时处理方式，之后再看看如何处理
    // NOTE 考虑更新 Page 定义，如何判断虚拟页？如何判断 layout？主题中如何选择 layout？
    // 当前使用的 layout 可以是自定义的，且在主题中根据此字段判断 layout（之前是根据 title 判断）
    // 但是 title 需要能够自定义，是否可以考虑改用 id 字段？
    if (page.collection == "virtual" && !page.url.endsWith('/')) {
      page.url = page.url + '/';
    }
    writeUrl(dist, page.url, html);
  }
  for (const asset of assets) {
    writeUrl(dist, asset.url, asset.buffer);
  }
}
