/**
 * Asset —— 资源对象
 * 核心为每个资源（文章专属 + 全局）维护的 Asset 实例。
 */
export interface Asset {
    /** 源文件绝对路径 */
    sourcePath: string;
    /** 输出 URL：专属资源 → 页面输出目录，全局资源 → /assets/（插件可在 process 阶段修改） */
    url: string;
    /** 文件内容（process 阶段可替换为处理后的 buffer） */
    buffer: Buffer;
    /** 类型：image/css/js/font/...，按扩展名推断 */
    type: string;
    /** 归属：文章专属资源为所属页面 id，全局资源为 "global" */
    belongsTo: string | "global";
}
