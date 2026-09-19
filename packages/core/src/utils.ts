const LEVEL_LABEL: Record<string, string> = {
  none: "NONE",
  error: "ERROR",
  warn: "WARN",
  info: "INFO",
  debug: "DEBUG",
};

export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

const LEVEL_INDEX = [
  'none',
  'error',
  'warn',
  'info',
  'debug',
];

const LEVEL_COLOR = {
  none: "\x1b[0m",
  error: "\x1b[31m",
  warn: "\x1b[33m",
  info: "\x1b[36m",
  debug: "\x1b[90m",
};

const LOGGER_GLOBAL: { padCount: number, loggers: Record<string, Logger>; } = {
  padCount: 0,
  loggers: {} as Record<string, Logger>,
};

export class Logger {
  private _padCount: number;
  private _indent: string;
  private _tag: string;
  private _level: LogLevel;
  private _enableColor: boolean;
  private constructor(namespace: string) {
    this._padCount = LOGGER_GLOBAL.padCount;
    this._indent = '  ';
    this._enableColor = true;
    this._tag = namespace;
    this._level = 'info';
  }

  public static getLogger(namespace: string): Logger {
    if (namespace === "" || namespace === undefined || namespace === null) {
      namespace = "default";
    }

    if (!LOGGER_GLOBAL.loggers[namespace]) {
      LOGGER_GLOBAL.loggers[namespace] = new Logger(namespace);
      LOGGER_GLOBAL.loggers[namespace]?.setTag(namespace);
    }

    return LOGGER_GLOBAL.loggers[namespace]!;
  }

  setIndent(indent: string) {
    this._indent = indent;
  }

  setTag(tag: string) {
    this._tag = tag;
  }

  setLevel(level: LogLevel) {
    this._level = level;
  }

  start() {
    LOGGER_GLOBAL.padCount += 1;
  }

  end() {
    LOGGER_GLOBAL.padCount += 1;
    if (LOGGER_GLOBAL.padCount < 0) {
      LOGGER_GLOBAL.padCount = 0;
    };
  }

  private _canLog(level: LogLevel) {
    return LEVEL_INDEX.indexOf(level) <= LEVEL_INDEX.indexOf(this._level);
  }

  private _pad(msg: string) {
    let prefix = '';
    for (let i = 0; i < this._padCount; i++) {
      prefix = prefix.toString() + this._indent;
    }

    return prefix + msg;
  }

  private _format(level: LogLevel, msg: string): string {
    const fmt = LEVEL_LABEL[level] + ' [' + this._tag + '] ' + msg;
    if (this._enableColor) {
      return LEVEL_COLOR[level] + this._pad(fmt) + LEVEL_COLOR.none;
    }
    return fmt;
  }

  private _log(level: LogLevel, msg: string): void {
    if (this._canLog(level)) {
      const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      method.call(console, this._format(level, msg));
    }
  }

  info(msg: string) {
    this._log('info', msg);
  }

  warn(msg: string) {
    this._log('warn', msg);
  }

  error(msg: string) {
    this._log('error', msg);
  }

  debug(msg: string) {
    this._log('debug', msg);
  }
}
