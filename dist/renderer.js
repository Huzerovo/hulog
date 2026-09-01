/**
 * 渲染器注册表实现。
 * 内置默认 renderer（renderMarkdown）在 build 开头注册；
 * 用户 renderer 经 `register` 覆盖之（单一活动渲染器，后注册者胜出）。
 */
// FIXME 将这个改造成多渲染器，active改为 []，get 添加 name 参数
export class RendererRegistryImpl {
    active = new Map();
    register(name, render) {
        this.active.set(name, render);
        void name;
    }
    get(name) {
        return this.active.get(name);
    }
}
//# sourceMappingURL=renderer.js.map