import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import chokidar from "chokidar";
import { build } from "@hulog/core";
const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
};
/** 注入热重载客户端脚本（WebSocket 收到 reload 消息才刷新；断线重连也刷新一次） */
const RELOAD_SCRIPT = (port) => `<script>
(function(){
  var ws = new WebSocket("ws://" + location.host + "/__reload");
  ws.onmessage = function(e){ if (e.data === "reload") location.reload(); };
  ws.onclose = function(){ setTimeout(function(){ location.reload(); }, 1000); };
})();
</script>`;
export async function devCmd(opts) {
    const cwd = opts.base;
    const port = opts.port;
    const distDir = path.join(cwd, "dist");
    // 静态服务器
    const server = http.createServer((req, res) => {
        const rawPath = (req.url ?? "/").split("?")[0];
        const urlPath = decodeURIComponent(rawPath);
        let rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
        let abs = path.join(distDir, rel);
        // 目录名可能是编码形式（如 /categories/%E9%9A%8F%E7%AC%94/），原样路径也尝试
        if (!abs.startsWith(distDir)) {
            res.writeHead(403);
            res.end("forbidden");
            return;
        }
        if (!fs.existsSync(abs)) {
            const rawRel = rawPath === "/" ? "index.html" : rawPath.replace(/^\/+/, "");
            const rawAbs = path.join(distDir, rawRel);
            if (rawAbs.startsWith(distDir) && fs.existsSync(rawAbs))
                abs = rawAbs;
        }
        if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
            abs = path.join(abs, "index.html");
        }
        if (!fs.existsSync(abs)) {
            res.writeHead(404);
            res.end("404 Not Found");
            return;
        }
        const ext = path.extname(abs).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
        let body = fs.readFileSync(abs);
        if (ext === ".html") {
            // 注入热重载脚本
            body = Buffer.from(String(body).replace("</body>", RELOAD_SCRIPT(port) + "</body>"));
        }
        res.end(body);
    });
    // WebSocket 热重载：仅广播 "reload"，连接建立时不发消息（否则浏览器无条件刷新导致循环）
    const wss = new WebSocketServer({ server, path: "/__reload" });
    const notifyReload = () => {
        for (const client of wss.clients) {
            if (client.readyState === WebSocket.OPEN)
                client.send("reload");
        }
    };
    // 首次构建（dev 模式：渲染草稿）
    await rebuild("initial");
    await new Promise((resolve) => server.listen(port, resolve));
    console.log(`✓ dev server: http://localhost:${port}（草稿已启用渲染）`);
    // 监听变化 → 防抖重建
    let timer = null;
    const watcher = chokidar.watch([
        path.join(cwd, "content"),
        path.join(cwd, "themes"),
        path.join(cwd, "blog.config.ts"),
        path.join(cwd, "theme.config.ts"),
        path.join(cwd, "assets"),
        path.join(cwd, "public"),
    ], { ignoreInitial: true });
    watcher.on("all", (_event, file) => {
        if (timer)
            clearTimeout(timer);
        timer = setTimeout(() => {
            rebuild("change").catch((e) => console.error("[rebuild failed]", e));
        }, 200);
    });
    async function rebuild(reason) {
        const start = Date.now();
        try {
            const result = await build({ cwd, dev: true });
            notifyReload();
            console.log(`[${reason}] 重建完成: ${result.pages.length} 页 (${Date.now() - start}ms)`);
        }
        catch (e) {
            console.error(`[${reason}] 构建失败:`, e.message);
            // 构建失败也通知刷新，让浏览器显示错误页
            notifyReload();
        }
    }
}
//# sourceMappingURL=dev.js.map