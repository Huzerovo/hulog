import { unified, type Plugin } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import { visit } from "unist-util-visit";
import { toString } from "hast-util-to-string";
import type { Root } from "hast";
import { createHighlighterCoreSync, createJavaScriptRegexEngine, type HighlighterGeneric } from "shiki";
import type { Page, SiteConfig } from "./types";
import { resolveAssetRef, type ResolveContext } from "./assets.js";

/**
 * Markdown 渲染管线：unified / remark / rehype，GFM 方言
 *
 * remark-parse → remark-gfm → remark-math → remark-rehype(allowDangerousHtml)
 *   → rehype-raw → rehype-slug → 目录收集 → 资源引用解析（rehype-resolve-assets）
 *   → rehype-katex → @shikijs/rehype（构建时高亮）→ rehype-stringify
 *
 * GFM 支持（remark-gfm）：表格、任务列表、删除线、自动链接（URL/邮箱）、脚注。
 */

export interface MarkdownContext {
  config: SiteConfig;
  resolve: ResolveContext;
}

/** 目录条目 */
export interface TocEntry {
  level: number; // 1-3
  id: string;
  text: string;
}

export interface MarkdownResult {
  html: string;
  toc: TocEntry[];
}

// ---------- shiki 高亮器（模块级单例，dev 重建复用） ----------
/** 常用语言集合（动态导入，仅注册需要的语言） */
const COMMON_LANGS = (() => {
  const load = (m: unknown) => m;
  return [
    load(import("@shikijs/langs/abap")),
    load(import("@shikijs/langs/actionscript-3")),
    load(import("@shikijs/langs/ada")),
    load(import("@shikijs/langs/ahk")),
    load(import("@shikijs/langs/angular-html")),
    load(import("@shikijs/langs/apache")),
    load(import("@shikijs/langs/apex")),
    load(import("@shikijs/langs/applescript")),
    load(import("@shikijs/langs/asciidoc")),
    load(import("@shikijs/langs/astro")),
    load(import("@shikijs/langs/awk")),
    load(import("@shikijs/langs/bat")),
    load(import("@shikijs/langs/bash")),
    load(import("@shikijs/langs/bibtex")),
    load(import("@shikijs/langs/bicep")),
    load(import("@shikijs/langs/c")),
    load(import("@shikijs/langs/clojure")),
    load(import("@shikijs/langs/cmake")),
    load(import("@shikijs/langs/coffeescript")),
    load(import("@shikijs/langs/common-lisp")),
    load(import("@shikijs/langs/cpp")),
    load(import("@shikijs/langs/csharp")),
    load(import("@shikijs/langs/css")),
    load(import("@shikijs/langs/csv")),
    load(import("@shikijs/langs/cue")),
    load(import("@shikijs/langs/dart")),
    load(import("@shikijs/langs/diff")),
    load(import("@shikijs/langs/docker")),
    load(import("@shikijs/langs/elixir")),
    load(import("@shikijs/langs/elm")),
    load(import("@shikijs/langs/erlang")),
    load(import("@shikijs/langs/fish")),
    load(import("@shikijs/langs/fsharp")),
    load(import("@shikijs/langs/gdscript")),
    load(import("@shikijs/langs/git-commit")),
    load(import("@shikijs/langs/git-rebase")),
    load(import("@shikijs/langs/gleam")),
    load(import("@shikijs/langs/go")),
    load(import("@shikijs/langs/graphql")),
    load(import("@shikijs/langs/groovy")),
    load(import("@shikijs/langs/handlebars")),
    load(import("@shikijs/langs/haskell")),
    load(import("@shikijs/langs/hcl")),
    load(import("@shikijs/langs/ini")),
    load(import("@shikijs/langs/java")),
    load(import("@shikijs/langs/javascript")),
    load(import("@shikijs/langs/jinja")),
    load(import("@shikijs/langs/julia")),
    load(import("@shikijs/langs/json")),
    load(import("@shikijs/langs/json5")),
    load(import("@shikijs/langs/jsonc")),
    load(import("@shikijs/langs/jsx")),
    load(import("@shikijs/langs/julia")),
    load(import("@shikijs/langs/kotlin")),
    load(import("@shikijs/langs/less")),
    load(import("@shikijs/langs/liquid")),
    load(import("@shikijs/langs/lua")),
    load(import("@shikijs/langs/makefile")),
    load(import("@shikijs/langs/markdown")),
    load(import("@shikijs/langs/matlab")),
    load(import("@shikijs/langs/mdx")),
    load(import("@shikijs/langs/mermaid")),
    load(import("@shikijs/langs/nim")),
    load(import("@shikijs/langs/nix")),
    load(import("@shikijs/langs/objective-c")),
    load(import("@shikijs/langs/ocaml")),
    load(import("@shikijs/langs/php")),
    load(import("@shikijs/langs/plsql")),
    load(import("@shikijs/langs/powershell")),
    load(import("@shikijs/langs/prisma")),
    load(import("@shikijs/langs/prolog")),
    load(import("@shikijs/langs/pug")),
    load(import("@shikijs/langs/puppet")),
    load(import("@shikijs/langs/python")),
    load(import("@shikijs/langs/r")),
    load(import("@shikijs/langs/racket")),
    load(import("@shikijs/langs/raku")),
    load(import("@shikijs/langs/ruby")),
    load(import("@shikijs/langs/rust")),
    load(import("@shikijs/langs/sass")),
    load(import("@shikijs/langs/scala")),
    load(import("@shikijs/langs/scss")),
    load(import("@shikijs/langs/shellscript")),
    load(import("@shikijs/langs/solidity")),
    load(import("@shikijs/langs/sparql")),
    load(import("@shikijs/langs/sql")),
    load(import("@shikijs/langs/stylus")),
    load(import("@shikijs/langs/svelte")),
    load(import("@shikijs/langs/swift")),
    load(import("@shikijs/langs/system-verilog")),
    load(import("@shikijs/langs/tcl")),
    load(import("@shikijs/langs/toml")),
    load(import("@shikijs/langs/tsv")),
    load(import("@shikijs/langs/tsx")),
    load(import("@shikijs/langs/twig")),
    load(import("@shikijs/langs/typescript")),
    load(import("@shikijs/langs/vb")),
    load(import("@shikijs/langs/verilog")),
    load(import("@shikijs/langs/vhdl")),
    load(import("@shikijs/langs/vue")),
    load(import("@shikijs/langs/wasm")),
    load(import("@shikijs/langs/xml")),
    load(import("@shikijs/langs/yaml")),
    load(import("@shikijs/langs/zig")),
  ];
})();

let highlighter: HighlighterGeneric<any, any> | null = null;

/** 初始化（懒加载，模块级单例复用） */
async function getHighlighter(): Promise<HighlighterGeneric<any, any>> {
  if (highlighter) return highlighter;
  const langs = await Promise.all(
    COMMON_LANGS.map((l) => (l as Promise<unknown>).then((m: any) => m.default ?? m)),
  );
  const theme = (await import("@shikijs/themes/github-dark")).default;
  highlighter = createHighlighterCoreSync({
    themes: [theme],
    langs: langs as any,
    engine: createJavaScriptRegexEngine(),
  }) as unknown as HighlighterGeneric<any, any>;
  return highlighter;
}

// ---------- 自定义 rehype 插件 ----------

/** 收集 h1-h3 生成目录（rehype-slug 之后执行） */
function rehypeCollectToc(toc: TocEntry[]): () => (tree: Root) => void {
  return () => (tree: Root): void => {
    visit(tree, "element", (node) => {
      const m = /^h([1-6])$/.exec(node.tagName);
      if (!m) return;
      const level = Number(m[1]);
      if (level < 1 || level > 3) return;
      const id = node.properties.id;
      if (typeof id !== "string" || !id) return;
      // 排除 GFM 脚注自动生成的区块标题（id 固定为 footnote-label）
      if (id === "footnote-label") return;
      toc.push({ level, id, text: toString(node).trim() });
    });
  };
}

/** 语言类名规范化：小写 + shell/sh → bash（与旧 markdown-it 高亮行为一致） */
function normalizeLangClass(cls: string): string {
  if (!cls.startsWith("language-")) return cls;
  const lang = cls.slice("language-".length).toLowerCase();
  const mapped = lang === "shell" || lang === "sh" ? "bash" : lang;
  return `language-${mapped}`;
}

/** 语言类名预处理（rehype-shiki 之前执行，保证别名/大小写可命中已加载语言） */
function rehypeNormalizeLangs(): () => (tree: Root) => void {
  return () => (tree: Root): void => {
    visit(tree, "element", (node) => {
      const cls: unknown = node.properties.className;
      if (typeof cls === "string") {
        node.properties.className = [normalizeLangClass(cls)];
      } else if (Array.isArray(cls)) {
        node.properties.className = cls.map((c) => normalizeLangClass(c));
      }
    });
  };
}

/** 资源引用解析 */
function rehypeResolveAssets(page: Page, resolve: ResolveContext): () => (tree: Root) => void {
  return () => (tree: Root): void => {
    visit(tree, "element", (node) => {
      if (node.tagName === "img") {
        const src = node.properties.src;
        if (typeof src === "string" && src) {
          const resolved = resolveAssetRef(src, page, resolve);
          if (resolved === null) {
            throw new Error(
              `[${page.id}] 图片引用未命中任何资源: "${src}"（已在文章专属目录与全局 assetsDir 查找）`,
            );
          }
          node.properties.src = resolved;
        }
      } else if (node.tagName === "a") {
        const href = node.properties.href;
        if (
          href &&
          typeof href === "string" &&
          (href.startsWith("./") || href.startsWith("../") || /^[\w.-]+\.\w+/.test(href))
        ) {
          const resolved = resolveAssetRef(href, page, resolve);
          if (resolved !== null) node.properties.href = resolved;
        }
      }
    });
  };
}

/**
 * 渲染 Markdown → HTML + 目录
 */
export async function renderMarkdown(
  rawContent: string,
  page: Page,
  ctx: MarkdownContext,
): Promise<MarkdownResult> {
  const { config } = ctx;
  const md = config.markdown ?? {};
  const useShiki = md.highlight !== false && !md.clientHighlight;
  const useKatex = md.katex !== false;

  const toc: TocEntry[] = [];
  const processor = unified().use(remarkParse).use(remarkGfm);
  if (useKatex) processor.use(remarkMath);
  // 自定义插件：unified 会把传入函数当工厂调用（返回 transformer），此处断言仅用于安抚类型推断
  processor
    .use(remarkRehype, { allowDangerousHtml: true, footnoteLabel: "脚注" })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeCollectToc(toc) as unknown as Plugin)
    .use(rehypeResolveAssets(page, ctx.resolve) as unknown as Plugin);
  // rehype-katex 内部固定 throwOnError: false（不对外暴露该选项）
  if (useKatex) processor.use(rehypeKatex as unknown as Plugin);
  if (useShiki) {
    const hl = await getHighlighter();
    processor
      .use(rehypeNormalizeLangs() as unknown as Plugin)
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
export function defaultSlugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^\w\u4e00-\u9fa5\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "section"
  );
}
