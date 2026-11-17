import type { HelperRegistry } from "../../types/helper.js";
import type { Hooks } from "../../types/hook.js";
/**
 * 展开 markdown 源码中的 linkToPost 占位为 Markdown 链接。
 * 未命中的占位保持原样并输出警告（便于作者发现标题拼写问题）。
 */
export declare function expandLinkToPost(raw: string, pageId: string, helper: HelperRegistry): string;
/** 注册核心 hook：beforeRender 展开 markdown 内的 linkToPost 占位 */
export declare function registerCoreHooks(hooks: Hooks, helper: HelperRegistry): void;
