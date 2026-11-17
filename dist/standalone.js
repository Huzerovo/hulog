import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import less from "less";
import { SITE_CONFIG_DEFAULTS, SITE_CONFIG_PLACES, loadSiteConfig } from "./config.js";
import { loadTheme, renderPage } from "./theme/index.js";
import { renderMarkdown } from "./markdown.js";
import { SiteImpl } from "./site.js";
import { CollectionImpl } from "./collection.js";
import { HelperRegistryImpl, registerCoreHelpers } from "./plugins/helper.js";
import { CoreApiImpl } from "./core-api.js";
import { assetType } from "./assets.js";
import { toPosixPath } from "./path.js";
import { Logger } from "./utils.js";
const logger = Logger.getLogger("core:standalone");
const MIME = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    avif: "image/avif",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    eot: "application/vnd.ms-fontobject",
};
/** 文件 → data URI */
function toDataUri(file, buffer) {
    const ext = path.extname(file).slice(1).toLowerCase();
    const mime = MIME[ext] ?? "application/octet-stream";
    return `data:${mime};base64,${buffer.toString("base64")}`;
}
/** Date 归一化（支持 Date / 字符串） */
function toDate(value) {
    if (!value)
        return undefined;
    const d = value instanceof Date ? value : new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
}
/**
 * 提取首个 H1 标题（跳过围栏代码块内），并从正文移除该行及紧随的空行。
 * 无 H1 时返回 null 与原文。
 */
function extractH1(raw) {
    const lines = raw.split("\n");
    let fence = null;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const fe = /^\s*(```|~~~)/.exec(line);
        if (fe) {
            if (!fence)
                fence = fe[1];
            else if (fence === fe[1])
                fence = null;
            continue;
        }
        if (fence)
            continue;
        const m = /^[ \t]*#[ \t]+(.+?)[ \t]*$/.exec(line);
        if (!m)
            continue;
        const title = m[1].trim();
        lines.splice(i, 1);
        while (i < lines.length && lines[i].trim() === "")
            lines.splice(i, 1);
        return { title, content: lines.join("\n") };
    }
    return { title: null, content: raw };
}
/** 递归列出目录下所有文件（相对路径，POSIX） */
function walkFiles(dir) {
    const out = [];
    const walk = (d, base) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const abs = path.join(d, entry.name);
            const rel = base ? `${base}/${entry.name}` : entry.name;
            if (entry.isDirectory())
                walk(abs, rel);
            else if (entry.isFile())
                out.push(rel);
        }
    };
    walk(dir, "");
    return out;
}
/**
 * 收集主题资源（.less 编译为 CSS、`_` partial 跳过），键为站点内 URL
 * （与 helper themeAsset 生成的 URL 一致），供后续内联。
 */
async function collectThemeAssets(themePath, themeName, config, out) {
    const assetsDirName = config.assetsDir ?? "assets";
    const dir = path.join(themePath, assetsDirName);
    if (!fs.existsSync(dir))
        return;
    const prefix = config.themeAssetsMode === "namespace"
        ? `/${assetsDirName}/${themeName}`
        : `/${assetsDirName}`;
    for (const rel of walkFiles(dir)) {
        const abs = path.join(dir, rel);
        if (/\.less$/i.test(rel)) {
            if (path.basename(rel).startsWith("_"))
                continue; // partial 仅作 @import 源
            const css = (await less.render(fs.readFileSync(abs, "utf8"), { filename: abs })).css;
            const url = prefix + "/" + toPosixPath(rel.replace(/\.less$/i, ".css"));
            out.set(url, {
                sourcePath: abs,
                url,
                buffer: Buffer.from(css),
                type: "css",
                belongsTo: "global",
            });
        }
        else {
            const url = prefix + "/" + toPosixPath(rel);
            out.set(url, {
                sourcePath: abs,
                url,
                buffer: fs.readFileSync(abs),
                type: assetType(rel),
                belongsTo: "global",
            });
        }
    }
}
/** 内联 CSS 中的本地 url(...)（相对 CSS 所在 URL 解析） */
function inlineCssUrls(css, cssUrl, assets) {
    const baseDir = cssUrl.replace(/[^/]*$/, "");
    return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, _quote, ref) => {
        if (/^(data:|https?:|\/\/|#)/i.test(ref))
            return whole;
        const abs = ref.startsWith("/") ? ref : path.posix.normalize(baseDir + ref);
        const asset = assets.get(abs);
        if (!asset)
            return whole;
        return `url("${toDataUri(asset.sourcePath, asset.buffer)}")`;
    });
}
/** 将 HTML 中的主题 stylesheet/script/img 替换为内联内容（自包含） */
function inlineHtml(html, assets) {
    // <link rel="stylesheet" href="..."> → <style>...</style>
    html = html.replace(/<link\b([^>]*?)\/?>/g, (whole, attrs) => {
        const rel = /rel="([^"]*)"/.exec(attrs)?.[1] ?? "";
        const href = /href="([^"]*)"/.exec(attrs)?.[1];
        if (!href || !/stylesheet/i.test(rel))
            return whole;
        const asset = assets.get(href);
        if (!asset)
            return whole; // 外部 CDN（katex 等）保持外链
        return `<style>${inlineCssUrls(asset.buffer.toString("utf8"), href, assets)}</style>`;
    });
    // <script src="...">... </script> → 内联脚本（其他属性保留）
    html = html.replace(/<script\b([^>]*?)\bsrc="([^"]+)"([^>]*)><\/script>/g, (whole, pre, src, post) => {
        const asset = assets.get(src);
        if (!asset)
            return whole; // 外部 CDN / type=module 的 CDN 脚本保持外链
        const attrs = (pre + post).replace(/\s+/g, " ").trim();
        const code = asset.buffer
            .toString("utf8")
            .replace(/<\/script/gi, "<\\/script");
        return `<script${attrs ? " " + attrs : ""}>${code}</script>`;
    });
    // 主题内本地 <img src> → data URI（正文图片已在 markdown 阶段处理）
    html = html.replace(/(<img\b[^>]*?)\bsrc="([^"]+)"([^>]*>)/g, (whole, pre, src, post) => {
        const asset = assets.get(src);
        if (!asset)
            return whole;
        return `${pre}src="${toDataUri(asset.sourcePath, asset.buffer)}"${post}`;
    });
    // data URI 图片若同时出现在 <a href> 中会产生整份重复（主题的图片链接包裹），
    // 移除该 href：灯箱使用内部 <img> 的 src，不影响交互。
    html = html.replace(/<a\b[^>]*>/g, (tag) => tag.replace(/\s+href="data:[^"]*"/i, ""));
    return html;
}
/**
 * 单文件 markdown 渲染：合成 Page/Site，复用 markdown 管线与主题布局，
 * 最后把主题资源与图片内联，写出单个自包含 HTML。
 */
export async function renderMarkdownFile(options) {
    const root = path.resolve(options.root ?? process.cwd());
    const absFile = path.resolve(options.file);
    if (!fs.existsSync(absFile) || !fs.statSync(absFile).isFile()) {
        throw new Error(`Markdown 文件不存在: ${absFile}`);
    }
    // 站点配置：root 有配置文件则读取（保持与站点一致），否则用默认值 + options.theme
    const hasConfig = SITE_CONFIG_PLACES.some((f) => fs.existsSync(path.join(root, f)));
    let config;
    if (hasConfig) {
        config = { ...(await loadSiteConfig(root)) };
    }
    else {
        if (!options.theme) {
            throw new Error(`未找到站点配置（${SITE_CONFIG_PLACES.join(" / ")}），请使用 --theme 指定主题`);
        }
        config = {
            ...SITE_CONFIG_DEFAULTS,
            siteTitle: path.basename(root) || "Untitled",
            theme: options.theme,
            collections: [],
        };
    }
    const themeName = options.theme ?? config.theme;
    if (!themeName) {
        throw new Error("未指定主题：请在 blog.config.ts 配置 theme，或使用 --theme");
    }
    const layout = options.layout ?? "post";
    // 读取正文；纯 markdown 无 front-matter（若存在也忽略）
    const raw = fs.readFileSync(absFile, "utf8");
    const { content: body } = matter(raw);
    const extracted = extractH1(body);
    const title = options.title ??
        extracted.title ??
        path.basename(absFile, path.extname(absFile));
    // 显式 --title 时保留正文 H1；否则使用移除首个 H1 后的正文
    const rawContent = options.title ? body : extracted.content;
    const stats = fs.statSync(absFile);
    const date = toDate(options.date) ?? stats.mtime;
    const slug = path.basename(absFile, path.extname(absFile));
    const id = toPosixPath(path.relative(root, absFile));
    // 合成集合（themes/helpers 以 posts 集合为一等公民）
    const collections = [...(config.collections ?? [])];
    let postsConfig = collections.find((c) => c.name === "posts");
    if (!postsConfig) {
        postsConfig = {
            name: "posts",
            sourceDir: "",
            routePattern: "/:slug/",
            defaultLayout: layout,
        };
        collections.push(postsConfig);
    }
    config = { ...config, collections };
    const page = {
        id,
        url: `/${encodeURIComponent(slug)}/`,
        title,
        layout,
        date,
        updated: date,
        draft: false,
        tags: [],
        categories: [],
        collection: "posts",
        sourcePath: absFile,
        slug,
        rawContent,
        content: "",
        data: {},
        metadata: {},
    };
    const site = new SiteImpl(config);
    site.collections.set("posts", new CollectionImpl("posts", postsConfig, [page]));
    // helpers（themeAsset/assetUrl 与站点语义一致，渲染后统一内联）
    const helper = new HelperRegistryImpl(site);
    registerCoreHelpers(helper);
    // 主题 + 主题资源
    const { theme, themePath } = await loadTheme(themeName, root);
    const themeAssets = new Map();
    await collectThemeAssets(themePath, theme.name, config, themeAssets);
    // 正文图片：相对 md 文件解析、/ 开头相对站点根解析；图片/字体转 data URI
    const assets = {
        list: [],
        resolve: (ref) => {
            if (/^(https?:)?\/\//i.test(ref) ||
                ref.startsWith("#") ||
                ref.startsWith("?") ||
                ref.startsWith("data:")) {
                return ref;
            }
            const abs = ref.startsWith("/")
                ? path.join(root, ref.replace(/^\/+/, ""))
                : path.resolve(path.dirname(absFile), ref);
            if (!fs.existsSync(abs) || !fs.statSync(abs).isFile())
                return ref; // 未命中保持原样
            const type = assetType(abs);
            if (type !== "image" && type !== "font")
                return ref;
            return toDataUri(abs, fs.readFileSync(abs));
        },
    };
    // Markdown → HTML（+ toc）
    const md = await renderMarkdown(rawContent, page, { config, assets });
    page.content = md.html;
    page.metadata.toc = md.toc;
    // 主题布局 → 完整 HTML
    const core = new CoreApiImpl(root, site, theme, helper);
    const html = inlineHtml(renderPage(theme, { page, api: core }), themeAssets);
    // 写出
    const outFile = path.resolve(options.outFile ??
        `${absFile.replace(/\.md$/i, "")}.html`);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html);
    logger.info(`已生成 ${outFile}`);
    return { outFile, html };
}
//# sourceMappingURL=standalone.js.map