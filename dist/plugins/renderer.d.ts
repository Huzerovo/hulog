import type { Renderer, RendererRegistry } from "../types/renderer.js";
/**
 * 渲染器注册表实现。
 * 内置默认 renderer（renderMarkdown）在 init 阶段以 "markdown" 注册；
 * 用户 renderer 可注册同名以覆盖。
 */
export declare class RendererRegistryImpl implements RendererRegistry {
    private active;
    register(name: string, render: Renderer): void;
    get(name: string): Renderer | undefined;
}
