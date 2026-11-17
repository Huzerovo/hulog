export interface NewOptions {
    title: string;
    draft?: boolean;
    collection?: string;
}
/** 标题 → slug（小写、空格转连字符、保留中文字符） */
export declare function slugify(title: string): string;
export declare function newCmd(opts: NewOptions): Promise<void>;
