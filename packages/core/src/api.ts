import { initCorePlugins, loadSitePlugins, loadThemePlugins } from "./plugins.js";
import type { CoreAPI as CoreAPI, PluginsAPI } from "./types/api.js";
import { Site } from "./types/site.js";

class CoreApiImpl implements CoreAPI {
  private _site: Site;
  private _root: string;
  private _plugins: PluginsAPI;

  constructor(site: Site, cwd: string, plugins: PluginsAPI) {
    this._site = site;
    this._root = cwd;
    this._plugins = plugins;
  }

  get root() { return this._root; }
  get site() { return this._site; }
  get plugins() { return this._plugins; }
  get cwd() { return this._root; }
  get theme() { return this._site.theme; }
}

export async function initApi(site: Site, cwd: string): Promise<CoreAPI> {
  const plugins = await initCorePlugins(site, cwd);

  // 先加载 theme 插件，后加载 site 插件，确保 site 插件高优先级
  await loadThemePlugins(plugins, cwd, site.config.theme);
  await loadSitePlugins(plugins, cwd, site);

  const api = new CoreApiImpl(site, cwd, plugins);
  return api;
}
