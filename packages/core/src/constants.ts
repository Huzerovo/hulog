/**
 * 全局常量
 */

/**
 * CLI bin 名称（commander .name()、错误提示、文档引用统一使用）。
 *
 * ⚠️ 修改此值时需同步：
 * 1. packages/cli/package.json 的 "bin" 键名
 * 2. 安装后生成的符号链接（pnpm install / npm link 时自动更新）
 */
export const BIN_NAME = "hulog";
