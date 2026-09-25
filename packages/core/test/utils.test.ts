import { test } from "node:test";
import assert from "node:assert/strict";
import { Logger, type LogLevel } from "../src/utils.js";

/** 捕获 console 输出并原样还原 */
function capture(fn: () => void): string[] {
  const logs: string[] = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origErr = console.error;
  console.log = (s: unknown) => logs.push(String(s));
  console.warn = (s: unknown) => logs.push(String(s));
  console.error = (s: unknown) => logs.push(String(s));
  try {
    fn();
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origErr;
  }
  return logs;
}

/** 剥离 ANSI 颜色转义 */
function plain(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

/** 期望格式：`LEVEL [namespace] message`（无补位对齐） */
function expectLine(level: string, tag: string, msg: string): string {
  return `${level} [${tag}] ${msg}`;
}

/** 取指定命名空间的 Logger 并设置级别 */
function at(ns: string, level: LogLevel = "info"): Logger {
  const l = Logger.getLogger(ns);
  l.setLevel(level);
  return l;
}

test("Logger: 级别过滤（info 下 debug 静默，warn/error 可见）", () => {
  const logger = at("t-info", "info");
  const logs = capture(() => {
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
  });
  assert.equal(logs.length, 3);
  assert.equal(plain(logs[0]!), expectLine("INFO", "t-info", "i"));
  assert.equal(plain(logs[1]!), expectLine("WARN", "t-info", "w"));
  assert.equal(plain(logs[2]!), expectLine("ERROR", "t-info", "e"));
  assert.ok(!logs.some((l) => l.includes("DEBUG")));
});

test("Logger: 级别过滤（none 全部静默）", () => {
  const logger = at("t-none", "none");
  const logs = capture(() => {
    logger.error("e");
    logger.warn("w");
  });
  assert.deepEqual(logs, []);
});

test("Logger: Error 对象输出 message", () => {
  const logger = at("t-error", "error");
  const logs = capture(() => logger.error(new Error("boom")));
  assert.equal(logs.length, 1);
  assert.ok(logs[0]!.includes("boom"));
  assert.ok(!logs[0]!.includes("[object Object]"));
});

test("Logger: 完整 namespace 展示", () => {
  const root = at("root");
  const mid = at("root:child");
  const deep = at("root:child:leaf");
  const long = at("root:child:leaf:detail");
  const logs = capture(() => {
    root.info("r");
    mid.info("m");
    deep.info("d");
    long.info("x");
  }).map(plain);

  assert.equal(logs[0]!, expectLine("INFO", "root", "r"));
  assert.equal(logs[1]!, expectLine("INFO", "root:child", "m"));
  assert.equal(logs[2]!, expectLine("INFO", "root:child:leaf", "d"));
  assert.equal(logs[3]!, expectLine("INFO", "root:child:leaf:detail", "x"));
});

test("Logger: getLogger 单例，空命名空间归入 default", () => {
  assert.equal(Logger.getLogger("ns-a"), Logger.getLogger("ns-a"));
  assert.notEqual(Logger.getLogger("ns-a"), Logger.getLogger("ns-b"));
  assert.equal(Logger.getLogger(""), Logger.getLogger("default"));
});