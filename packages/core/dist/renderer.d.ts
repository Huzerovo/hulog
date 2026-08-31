import type { Renderer, RendererRegistry } from "./types/renderer.js";
/**
 * 渲染器注册表实现。
 * 内置默认 renderer（renderMarkdown）在 build 开头注册；
 * 用户 renderer 经 `register` 覆盖之（单一活动渲染器，后注册者胜出）。
 */
export declare class RendererRegistryImpl implements RendererRegistry {
    private active;
    register(name: string, render: Renderer): void;
    get(name: string): Renderer | undefined;
}
