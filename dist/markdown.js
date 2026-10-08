import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import rehypeTableWrapper from "@tuyuritio/rehype-table-wrapper";
import { visit } from "unist-util-visit";
import { toString } from "hast-util-to-string";
import { bundledLanguages, createHighlighterCoreSync, createJavaScriptRegexEngine, } from "shiki";
/**
 * Markdown 渲染管线：unified / remark / rehype，GFM 方言
 *
 * remark-parse → remark-gfm → remark-math → remark-rehype(allowDangerousHtml)
 *   → rehype-raw → rehype-slug → 目录收集 → 资源引用解析（rehype-resolve-assets）
 *   → rehype-katex → @shikijs/rehype（构建时高亮）→ rehype-stringify
 *
 * GFM 支持（remark-gfm）：表格、任务列表、删除线、自动链接（URL/邮箱）、脚注。
 */
// ---------- shiki 高亮器（模块级单例，dev 重建复用；语言按需加载） ----------
let highlighter = null;
let highlighterPromise = null;
/** 语言加载去重（并发渲染同一语言只加载一次） */
const langLoading = new Map();
/** 初始化核心高亮器（不预载语言；语言由 ensureLanguages 按文档按需加载） */
function getHighlighter() {
    if (!highlighterPromise) {
        highlighterPromise = (async () => {
            const theme = (await import("@shikijs/themes/github-dark")).default;
            highlighter = createHighlighterCoreSync({
                themes: [theme],
                langs: [],
                engine: createJavaScriptRegexEngine(),
            });
            return highlighter;
        })();
    }
    return highlighterPromise;
}
/**
 * 扫描 Markdown 代码围栏语言并按需加载（bundledLanguages 含别名，均为惰性 import）。
 * 未知语言不加载，交由 @shikijs/rehype 原样保留为普通代码块。
 */
async function ensureLanguages(hl, rawContent) {
    const names = new Set();
    const re = /(?:^|\n)[ \t]*(?:```|~~~)[ \t]*([^\s`~]*)/g;
    let m;
    while ((m = re.exec(rawContent))) {
        let name = (m[1] ?? "").trim().toLowerCase();
        if (!name)
            continue;
        if (name === "shell" || name === "sh")
            name = "bash";
        names.add(name);
    }
    await Promise.all([...names].map(async (name) => {
        if (hl.getLoadedLanguages().includes(name))
            return;
        const loader = bundledLanguages[name];
        if (!loader)
            return;
        let p = langLoading.get(name);
        if (!p) {
            p = hl.loadLanguage(loader()).catch(() => {
                // 语言加载失败 → 按纯文本渲染，不阻断构建
            });
            langLoading.set(name, p);
        }
        await p;
    }));
}
// ---------- 自定义 rehype 插件 ----------
/** 收集 h1-h3 生成目录（rehype-slug 之后执行） */
function rehypeCollectToc(toc) {
    return () => (tree) => {
        visit(tree, "element", (node) => {
            const m = /^h([1-6])$/.exec(node.tagName);
            if (!m)
                return;
            const level = Number(m[1]);
            if (level < 1 || level > 3)
                return;
            const id = node.properties.id;
            if (typeof id !== "string" || !id)
                return;
            // 排除 GFM 脚注自动生成的区块标题（id 固定为 footnote-label）
            if (id === "footnote-label")
                return;
            toc.push({ level, id, text: toString(node).trim() });
        });
    };
}
/** 语言类名规范化：小写 + shell/sh → bash（与旧 markdown-it 高亮行为一致） */
function normalizeLangClass(cls) {
    if (!cls.startsWith("language-"))
        return cls;
    const lang = cls.slice("language-".length).toLowerCase();
    const mapped = lang === "shell" || lang === "sh" ? "bash" : lang;
    return `language-${mapped}`;
}
/** 语言类名预处理（rehype-shiki 之前执行，保证别名/大小写可命中已加载语言） */
function rehypeNormalizeLangs() {
    return () => (tree) => {
        visit(tree, "element", (node) => {
            const cls = node.properties.className;
            if (typeof cls === "string") {
                node.properties.className = [normalizeLangClass(cls)];
            }
            else if (Array.isArray(cls)) {
                node.properties.className = cls.map((c) => normalizeLangClass(c));
            }
        });
    };
}
/** 资源引用解析 */
function rehypeResolveAssets(page, assets) {
    return () => (tree) => {
        visit(tree, "element", (node) => {
            if (node.tagName === "img") {
                const src = node.properties.src;
                if (typeof src === "string" && src) {
                    const resolved = assets.resolve(src, page);
                    if (resolved === null) {
                        throw new Error(`[${page.id}] 图片引用未命中任何资源: "${src}"（已在文章专属目录与全局 assetsDir 查找）`);
                    }
                    node.properties.src = resolved;
                }
            }
            else if (node.tagName === "a") {
                const href = node.properties.href;
                if (href &&
                    typeof href === "string" &&
                    (href.startsWith("./") || href.startsWith("../") || /^[\w.-]+\.\w+/.test(href))) {
                    const resolved = assets.resolve(href, page);
                    if (resolved !== null)
                        node.properties.href = resolved;
                }
            }
        });
    };
}
/**
 * Mermaid：将 ```mermaid 代码块转为 <pre class="mermaid">，保留源码文本，
 * 去掉 language- 类使 shiki 不再高亮；由主题在客户端调用 mermaid.run() 渲染。
 */
function rehypeMermaid() {
    return () => (tree) => {
        visit(tree, "element", (node) => {
            if (node.tagName !== "pre")
                return;
            const code = node.children.find((c) => c.type === "element" && c.tagName === "code");
            if (!code)
                return;
            const cls = code.properties?.className;
            const classes = Array.isArray(cls) ? cls : typeof cls === "string" ? [cls] : [];
            if (!classes.includes("language-mermaid"))
                return;
            // 保留源码文本，改为 mermaid 容器（去掉 language- 类，shiki 不再处理）
            node.properties = { className: ["mermaid"] };
            node.children = code.children;
        });
    };
}
/**
 * 渲染 Markdown → HTML + 目录
 */
export async function renderMarkdown(rawContent, page, ctx) {
    const { config } = ctx;
    const md = config.markdown ?? {};
    const useShiki = md.highlight !== false && !md.clientHighlight;
    const useKatex = md.katex !== false;
    const useMermaid = md.mermaid !== false;
    const toc = [];
    const processor = unified().use(remarkParse).use(remarkGfm);
    if (useKatex)
        processor.use(remarkMath);
    // 自定义插件：unified 会把传入函数当工厂调用（返回 transformer），此处断言仅用于安抚类型推断
    processor
        .use(remarkRehype, { allowDangerousHtml: true, footnoteLabel: "脚注" })
        .use(rehypeRaw)
        .use(rehypeTableWrapper)
        .use(rehypeSlug)
        .use(rehypeCollectToc(toc))
        .use(rehypeResolveAssets(page, ctx.assets));
    // Mermaid：在 shiki 之前把 mermaid 代码块转为 .mermaid 容器
    if (useMermaid)
        processor.use(rehypeMermaid());
    // rehype-katex 内部固定 throwOnError: false（不对外暴露该选项）
    if (useKatex)
        processor.use(rehypeKatex);
    if (useShiki) {
        const hl = await getHighlighter();
        await ensureLanguages(hl, rawContent);
        processor
            .use(rehypeNormalizeLangs())
            .use(rehypeShikiFromHighlighter, hl, {
            theme: "github-dark",
            defaultLanguage: "text", // 无语言标注的代码块按纯文本高亮（保持旧行为）
            addLanguageClass: true,
        });
    }
    processor.use(rehypeStringify);
    const file = await processor.process(rawContent);
    return { html: String(file), toc };
}
/**
 * 默认 slug 生成（保留：兼容旧 API；标题 id 现由 rehype-slug/github-slugger 生成）
 */
export function defaultSlugify(input) {
    return (input
        .toLowerCase()
        .trim()
        .replace(/[^\w\u4e00-\u9fa5\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "section");
}
//# sourceMappingURL=markdown.js.map