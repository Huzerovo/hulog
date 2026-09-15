export default function (api) {
    const virtualPage = api.helper.get("virtualPage");
    api.generator.register("core:vpage", (site) => {
        const vPages = site.config.virtualPages;
        const pages = [];
        for (const vp of vPages) {
            pages.push(virtualPage(vp));
        }
        return pages;
    });
}
//# sourceMappingURL=generator-vpage.js.map