/**
 * 轻量日志：命名空间 + 级别控制（none < error < warn < info < debug）+ ANSI 颜色。
 *
 * - 命名空间以 `:` 分层、完整展示（core / core:build / core:build:render），
 *   便于判断日志来源；不做补位对齐，格式为 `LEVEL [namespace] message`。
 * - 级别：默认 info，可用环境变量 HULOG_LOG_LEVEL 覆盖（none|error|warn|info|debug）。
 * - 颜色：设置 NO_COLOR 或 stdout 非 TTY（CI / 管道）时自动禁用。
 */

import process from "node:process";

export type LogLevel = "none" | "error" | "warn" | "info" | "debug";

const LEVEL_INDEX: LogLevel[] = ["none", "error", "warn", "info", "debug"];
const LEVEL_LABEL: Record<LogLevel, string> = {
  none: "NONE",
  error: "ERROR",
  warn: "WARN",
  info: "INFO",
  debug: "DEBUG",
};
const LEVEL_COLOR: Record<LogLevel, string> = {
  none: "\x1b[0m",
  error: "\x1b[31m",
  warn: "\x1b[33m",
  info: "\x1b[36m",
  debug: "\x1b[90m",
};

/** 默认日志级别：HULOG_LOG_LEVEL 环境变量覆盖，非法值回落 info */
function defaultLevel(): LogLevel {
  const v = (process.env.HULOG_LOG_LEVEL ?? "").trim().toLowerCase();
  return (LEVEL_INDEX as readonly string[]).includes(v)
    ? (v as LogLevel)
    : "info";
}

/** 颜色开关：NO_COLOR 或 stdout 非 TTY 时禁用 ANSI 转义 */
function defaultColor(): boolean {
  if (process.env.NO_COLOR) return false;
  return Boolean(process.stdout?.isTTY);
}

const LOGGER_GLOBAL: { loggers: Map<string, Logger> } = {
  loggers: new Map(),
};

export class Logger {
  private _tag: string;
  private _level: LogLevel;
  private _enableColor: boolean;

  private constructor(namespace: string) {
    this._tag = namespace;
    this._level = defaultLevel();
    this._enableColor = defaultColor();
  }

  /** 按命名空间取单例 Logger（空命名空间归入 "default"） */
  public static getLogger(namespace: string): Logger {
    const ns = namespace || "default";
    let logger = LOGGER_GLOBAL.loggers.get(ns);
    if (!logger) {
      logger = new Logger(ns);
      LOGGER_GLOBAL.loggers.set(ns, logger);
    }
    return logger;
  }

  /** 自定义标签（覆盖命名空间） */
  setTag(tag: string): void {
    this._tag = tag;
  }

  /** 覆盖本 Logger 的日志级别 */
  setLevel(level: LogLevel): void {
    this._level = level;
  }

  private _canLog(level: LogLevel): boolean {
    return LEVEL_INDEX.indexOf(level) <= LEVEL_INDEX.indexOf(this._level);
  }

  private _format(level: LogLevel, msg: string): string {
    const fmt = `${LEVEL_LABEL[level]} [${this._tag}] ${msg}`;
    if (!this._enableColor) return fmt;
    return LEVEL_COLOR[level] + fmt + LEVEL_COLOR.none;
  }

  private _log(level: LogLevel, msg: string | Error): void {
    if (!this._canLog(level)) return;
    const text = msg instanceof Error ? msg.message : msg;
    const method =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;
    method.call(console, this._format(level, text));
  }

  info(msg: string | Error): void {
    this._log("info", msg);
  }

  warn(msg: string | Error): void {
    this._log("warn", msg);
  }

  error(msg: string | Error): void {
    this._log("error", msg);
  }

  debug(msg: string | Error): void {
    this._log("debug", msg);
  }
}