export class CoreApiImpl {
    _root;
    _site;
    _theme;
    _helper;
    constructor(root, site, theme, helper) {
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
//# sourceMappingURL=core-api.js.map