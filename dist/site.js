/**
 * Site 实现
 */
export class SiteImpl {
    collections = new Map();
    _assets = [];
    _config = void 0;
    constructor(config) {
        this._config = config;
    }
    get pages() {
        return [...this.collections.values()].flatMap((c) => c.pages);
    }
    // 获取所有文章，若 renderDraft 为 true，则包含 drafts
    get posts() {
        const posts = this.collections.get("posts")?.getPages() ?? [];
        const drafts = this.collections.get("drafts")?.getPages() ?? [];
        if (this._config?.renderDraft) {
            // 默认按日期降序排序
            return [...posts, ...drafts].sort((a, b) => {
                const da = a.date?.getTime() ?? 0;
                const db = b.date?.getTime() ?? 0;
                return db - da;
            });
        }
        else {
            return posts.filter((p) => !p.draft);
        }
    }
    // get publishedPages(): Page[] {
    //   return this.pages.filter((p) => !p.draft);
    // }
    get assets() {
        return this._assets;
    }
    get config() {
        return this._config;
    }
    /** 由 build 阶段设置全部资源（专属 + 全局） */
    setAssets(assets) {
        this._assets = assets;
    }
    getAssets(dir) {
        return this._assets.filter((a) => a.sourcePath.startsWith(dir));
    }
}
//# sourceMappingURL=site.js.map