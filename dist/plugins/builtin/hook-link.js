import { Logger } from "../../utils.js";
/**
 * markdown 内联占位（参数需引号包裹，第二个可省略）：
 * {{linkToPost("标题")}}            → [标题](url)
 * {{linkToPost("标题", "集合")}}     → 限定集合查找
 * 在 beforeRender 阶段展开（渲染器与渲染流程保持不变）。
 */
const CALL_RE = /\{\{\s*linkToPost\s*\(\s*(?:"([^"]*)"|'([^']*)')(?:\s*,\s*(?:"([^"]*)"|'([^']*)'))?\s*\)\s*\}\}/g;
const logger = Logger.getLogger("core:link");
/** 跳过围栏代码块（``` / ~~~）内部：便于在文章中演示该语法而不被替换 */
function replaceOutsideFences(md, replacer) {
    const lines = md.split("\n");
    let fence = null;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const m = /^\s*(```|~~~)/.exec(line);
        if (m) {
            if (!fence)
                fence = m[1];
            else if (fence === m[1])
                fence = null;
            continue;
        }
        if (!fence)
            lines[i] = line.replace(CALL_RE, replacer);
    }
    return lines.join("\n");
}
/**
 * 展开 markdown 源码中的 linkToPost 占位为 Markdown 链接。
 * 未命中的占位保持原样并输出警告（便于作者发现标题拼写问题）。
 */
export function expandLinkToPost(raw, pageId, helper) {
    if (!raw.includes("linkToPost"))
        return raw;
    return replaceOutsideFences(raw, (match, titleDouble, titleSingle, collectionDouble, collectionSingle) => {
        const fn = helper.get("linkToPost");
        const title = (titleDouble ?? titleSingle ?? "").trim();
        const collection = (collectionDouble ?? collectionSingle ?? "").trim() || undefined;
        const link = fn ? fn(title, collection) : "";
        if (!link) {
            const scope = collection ? `（集合 ${collection}）` : "";
            logger.warn(`未找到标题为 "${title}" ${scope}的文章（${pageId}），占位保持原样`);
            return match;
        }
        return link;
    });
}
/** 注册核心 hook：beforeRender 展开 markdown 内的 linkToPost 占位 */
export function registerCoreHooks(hooks, helper) {
    hooks.beforeRender.tap("core:linkToPost", (page) => {
        page.rawContent = expandLinkToPost(page.rawContent, page.id, helper);
    });
}
//# sourceMappingURL=hook-link.js.map