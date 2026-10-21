/**
 * 轻量日志：命名空间 + 级别控制（none < error < warn < info < debug）+ ANSI 颜色。
 *
 * - 命名空间以 `:` 分层、完整展示（core / core:build / core:build:render），
 *   便于判断日志来源；不做补位对齐，格式为 `LEVEL [namespace] message`。
 * - 级别：默认 info，可用环境变量 HULOG_LOG_LEVEL 覆盖（none|error|warn|info|debug）。
 * - 颜色：设置 NO_COLOR 或 stdout 非 TTY（CI / 管道）时自动禁用。
 */
import process from "node:process";
const LEVEL_INDEX = ["none", "error", "warn", "info", "debug"];
const LEVEL_LABEL = {
    none: "NONE",
    error: "ERROR",
    warn: "WARN",
    info: "INFO",
    debug: "DEBUG",
};
const LEVEL_COLOR = {
    none: "\x1b[0m",
    error: "\x1b[31m",
    warn: "\x1b[33m",
    info: "\x1b[36m",
    debug: "\x1b[90m",
};
/** 默认日志级别：HULOG_LOG_LEVEL 环境变量覆盖，非法值回落 info */
function defaultLevel() {
    const v = (process.env.HULOG_LOG_LEVEL ?? "").trim().toLowerCase();
    return LEVEL_INDEX.includes(v)
        ? v
        : "info";
}
/** 颜色开关：NO_COLOR 或 stdout 非 TTY 时禁用 ANSI 转义 */
function defaultColor() {
    if (process.env.NO_COLOR)
        return false;
    return Boolean(process.stdout?.isTTY);
}
const LOGGER_GLOBAL = {
    loggers: new Map(),
};
export class Logger {
    _tag;
    _level;
    _enableColor;
    constructor(namespace) {
        this._tag = namespace;
        this._level = defaultLevel();
        this._enableColor = defaultColor();
    }
    /** 按命名空间取单例 Logger（空命名空间归入 "default"） */
    static getLogger(namespace) {
        const ns = namespace || "default";
        let logger = LOGGER_GLOBAL.loggers.get(ns);
        if (!logger) {
            logger = new Logger(ns);
            LOGGER_GLOBAL.loggers.set(ns, logger);
        }
        return logger;
    }
    /** 自定义标签（覆盖命名空间） */
    setTag(tag) {
        this._tag = tag;
    }
    /** 覆盖本 Logger 的日志级别 */
    setLevel(level) {
        this._level = level;
    }
    _canLog(level) {
        return LEVEL_INDEX.indexOf(level) <= LEVEL_INDEX.indexOf(this._level);
    }
    _format(level, msg) {
        const fmt = `${LEVEL_LABEL[level]} [${this._tag}] ${msg}`;
        if (!this._enableColor)
            return fmt;
        return LEVEL_COLOR[level] + fmt + LEVEL_COLOR.none;
    }
    _log(level, msg) {
        if (!this._canLog(level))
            return;
        const text = msg instanceof Error ? msg.message : msg;
        const method = level === "error"
            ? console.error
            : level === "warn"
                ? console.warn
                : console.log;
        method.call(console, this._format(level, text));
    }
    info(msg) {
        this._log("info", msg);
    }
    warn(msg) {
        this._log("warn", msg);
    }
    error(msg) {
        this._log("error", msg);
    }
    debug(msg) {
        this._log("debug", msg);
    }
}
//# sourceMappingURL=utils.js.map