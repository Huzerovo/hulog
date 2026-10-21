/**
 * 轻量日志：命名空间 + 级别控制（none < error < warn < info < debug）+ ANSI 颜色。
 *
 * - 命名空间以 `:` 分层、完整展示（core / core:build / core:build:render），
 *   便于判断日志来源；不做补位对齐，格式为 `LEVEL [namespace] message`。
 * - 级别：默认 info，可用环境变量 HULOG_LOG_LEVEL 覆盖（none|error|warn|info|debug）。
 * - 颜色：设置 NO_COLOR 或 stdout 非 TTY（CI / 管道）时自动禁用。
 */
export type LogLevel = "none" | "error" | "warn" | "info" | "debug";
export declare class Logger {
    private _tag;
    private _level;
    private _enableColor;
    private constructor();
    /** 按命名空间取单例 Logger（空命名空间归入 "default"） */
    static getLogger(namespace: string): Logger;
    /** 自定义标签（覆盖命名空间） */
    setTag(tag: string): void;
    /** 覆盖本 Logger 的日志级别 */
    setLevel(level: LogLevel): void;
    private _canLog;
    private _format;
    private _log;
    info(msg: string | Error): void;
    warn(msg: string | Error): void;
    error(msg: string | Error): void;
    debug(msg: string | Error): void;
}
