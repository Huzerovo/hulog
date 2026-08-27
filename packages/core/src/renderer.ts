import type { Renderer, RendererRegistry } from "./types/renderer.js";

/**
 * 渲染器注册表实现。
 * 内置默认 renderer（renderMarkdown）在 build 开头注册；
 * 用户 renderer 经 `register` 覆盖之（单一活动渲染器，后注册者胜出）。
 */
// FIXME 将这个改造成多渲染器，active改为 []，get 添加 name 参数
export class RendererRegistryImpl implements RendererRegistry {
  private active = new Map<string, Renderer>();

  register(name: string, render: Renderer): void {
    this.active.set(name, render);
    void name;
  }

  get(name: string): Renderer | undefined {
    return this.active.get(name);
  }
}
