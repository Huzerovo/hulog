export interface DevOptions {
    base: string;
    port: number;
}
export declare function devCmd(opts: DevOptions): Promise<void>;
