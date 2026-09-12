import type { Renderer, RendererRegistry } from "../types/renderer.js";

/**
 * 渲染器注册表实现。
 * 内置默认 renderer（renderMarkdown）在 init 阶段以 "markdown" 注册；
 * 用户 renderer 可注册同名以覆盖。
 */
export class RendererRegistryImpl implements RendererRegistry {
  private active = new Map<string, Renderer>();

  register(name: string, render: Renderer): void {
    this.active.set(name, render);
  }

  get(name: string): Renderer | undefined {
    return this.active.get(name);
  }
}
