export interface PublishOptions {
    slug?: string;
    all?: boolean;
    autoDate?: boolean;
    collection?: string;
}
export declare function publishCmd(opts: PublishOptions): Promise<void>;
