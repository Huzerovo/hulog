import { h } from "preact";
import { render } from "preact-render-to-string";
/**
 * 渲染单页：选择布局（精确 → default → page → 报错），preact-render-to-string 输出 HTML。
 */
export function renderPage(theme, props) {
    const { layouts } = theme;
    const layout = layouts[props.page.layout] ?? layouts.default ?? layouts.page;
    if (!layout) {
        throw new Error(`[${props.page.id}] 布局 "${props.page.layout}" 不存在，且主题无 default/page 布局回退`);
    }
    return "<!DOCTYPE html>\n" + render(h(layout, props));
}
//# sourceMappingURL=render.js.map