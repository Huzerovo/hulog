/**
 * tapable 风格异步钩子：按注册顺序依次执行（串行 await）。
 */
export class AsyncHookImpl {
    taps = [];
    tap(name, fn) {
        this.taps.push({ name, fn });
    }
    async call(...args) {
        for (const t of this.taps) {
            await t.fn(...args);
        }
    }
}
export function initHooks() {
    return {
        // init
        afterInit: new AsyncHookImpl(),
        // read
        afterRead: new AsyncHookImpl(),
        // parse
        afterParse: new AsyncHookImpl(),
        // filter
        afterFilter: new AsyncHookImpl(),
        // collect①（物理）
        afterCollectPhysical: new AsyncHookImpl(),
        // generate
        afterGenerate: new AsyncHookImpl(),
        // merge
        afterMerge: new AsyncHookImpl(),
        // collect②（虚拟）
        afterCollectVirtual: new AsyncHookImpl(),
        // process
        afterProcess: new AsyncHookImpl(),
        // render
        beforeRender: new AsyncHookImpl(),
        afterRender: new AsyncHookImpl(),
        // write
        beforeWrite: new AsyncHookImpl(),
        afterWrite: new AsyncHookImpl(),
    };
}
//# sourceMappingURL=hook.js.map