import type { CoreAPI } from "./types/api.js";
import type { HelperRegistry } from "./types/helper.js";
import type { Site } from "./types/site.js";
import type { Theme } from "./types/theme.js";
export declare class CoreApiImpl implements CoreAPI {
    private _root;
    private _site;
    private _theme;
    private _helper;
    constructor(root: string, site: Site, theme: Theme, helper: HelperRegistry);
    get root(): string;
    get site(): Site;
    get theme(): Theme;
    get helper(): HelperRegistry;
}
