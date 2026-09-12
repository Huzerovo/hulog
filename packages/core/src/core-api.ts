import type { CoreAPI } from "./types/api.js";
import type { HelperRegistry } from "./types/helper.js";
import type { Site } from "./types/site.js";
import type { Theme } from "./types/theme.js";

export class CoreApiImpl implements CoreAPI {
  private _root: string;
  private _site: Site;
  private _theme: Theme;
  private _helper: HelperRegistry;

  constructor(root: string, site: Site, theme: Theme, helper: HelperRegistry) {
    this._root = root;
    this._site = site;
    this._theme = theme;
    this._helper = helper;
  }

  get root() { return this._root; }
  get site() { return this._site; }
  get theme() { return this._theme; }
  get helper() { return this._helper; }
}
