import { Site } from "./site.js";
import { Theme } from "./theme.js";
import { GeneratorRegistry } from "./generator.js";
import { HelperRegistry } from "./helper.js";
import { Hooks } from "./hook.js";
import { RendererRegistry } from "./renderer.js";

export interface PluginsAPI {
  generators: GeneratorRegistry;
  helpers: HelperRegistry;
  hooks: Hooks;
  renderers: RendererRegistry;
}

export interface CoreAPI {
  /** 项目根目录 */
  get root(): string;
  /** 站点对象 */
  get site(): Site;
  /** 插件系统 */
  get plugins(): PluginsAPI;
  /** 主题对象 */
  get theme(): Theme;
  /** 兼容性 fallback */
  get cwd(): string;
}
