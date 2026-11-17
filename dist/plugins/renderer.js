/**
 * 渲染器注册表实现。
 * 内置默认 renderer（renderMarkdown）在 init 阶段以 "markdown" 注册；
 * 用户 renderer 可注册同名以覆盖。
 */
export class RendererRegistryImpl {
    active = new Map();
    register(name, render) {
        this.active.set(name, render);
    }
    get(name) {
        return this.active.get(name);
    }
}
//# sourceMappingURL=renderer.js.map