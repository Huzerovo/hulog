/**
 * 分类工具：front-matter categories 解析与层级处理。
 *
 * front-matter 支持三种写法（可混用、任意深度嵌套）：
 * ```yaml
 * categories:
 *   - 分类一                 # 普通字符串
 *   - 分类二:                 # 嵌套映射 → 子分类
 *       - 子分类1
 *       - 子分类2
 *   - 分类三/子分类           # "父/子" 路径字符串
 * ```
 * 解析结果为 CategoryPath[]（每条 = 从根到叶的完整路径）。
 */
const SEP = "/";
function isPlainObject(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
/** 字符串按 "/" 拆段并去除空白段 */
function splitSegs(name) {
    return name
        .split(SEP)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}
/** 空值（null/空串/空数组/空对象）→ 仅作为叶子分类存在 */
function isEmptyValue(v) {
    if (v == null)
        return true;
    if (typeof v === "string")
        return v.trim() === "";
    if (Array.isArray(v))
        return v.length === 0;
    if (isPlainObject(v))
        return Object.keys(v).length === 0;
    return false;
}
function walk(value, parent, out) {
    // 标量（字符串/数字/布尔）→ 叶子，支持 "父/子" 路径写法
    if (typeof value !== "object" || value === null) {
        if (value == null)
            return;
        const segs = splitSegs(String(value));
        if (segs.length > 0)
            out.push([...parent, ...segs]);
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value)
            walk(item, parent, out);
        return;
    }
    // 映射：每个 key 是一层分类名，value 为其子分类（空值 = 叶子）
    for (const [key, child] of Object.entries(value)) {
        const segs = splitSegs(key);
        if (segs.length === 0)
            continue;
        const p = [...parent, ...segs];
        if (isEmptyValue(child))
            out.push(p);
        else
            walk(child, p, out);
    }
}
/**
 * 解析 front-matter categories 为完整路径列表（去重，保持出现顺序）。
 * 不支持的类型（如纯数字数组之外的奇怪结构）会被忽略。
 */
export function parseCategories(value) {
    const out = [];
    walk(value, [], out);
    const seen = new Set();
    return out.filter((p) => {
        const k = JSON.stringify(p);
        if (seen.has(k))
            return false;
        seen.add(k);
        return true;
    });
}
/** 路径 → 展示字符串："父/子" */
export function categoryPathToString(path) {
    return path.join(SEP);
}
/**
 * 路径 → 分类页 URL：/categories/<seg1>/<seg2>/（各段 encodeURIComponent，以 / 结尾）。
 * base 可覆盖前缀（默认 "/categories"）。
 */
export function categoryPathToUrl(path, base = "/categories") {
    const segs = path.map((s) => encodeURIComponent(s)).join("/");
    return `${base.replace(/\/+$/, "")}/${segs}/`;
}
/**
 * 由文章分类路径构建分类树（含祖先节点）。
 * 每条路径会为其所有前缀（祖先）建立节点，node.count = 该分类直接或间接包含的文章数。
 * 返回按名称排序的顶层节点；children 同样排序。
 */
export function buildCategoryTree(paths) {
    const root = new Map();
    for (const path of paths) {
        if (path.length === 0)
            continue;
        let level = root;
        for (let i = 0; i < path.length; i++) {
            const seg = path[i];
            let node = level.get(seg);
            if (!node) {
                node = {
                    name: seg,
                    path: path.slice(0, i + 1),
                    count: 0,
                    children: [],
                    childrenMap: new Map(),
                };
                level.set(seg, node);
            }
            node.count++;
            level = node.childrenMap;
        }
    }
    const finalize = (map) => {
        const nodes = [...map.values()].map((n) => {
            const { childrenMap, ...rest } = n;
            return { ...rest, children: finalize(childrenMap) };
        });
        nodes.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
        return nodes;
    };
    return finalize(root);
}
//# sourceMappingURL=category.js.map