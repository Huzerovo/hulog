import type { GeneratorAPI } from "../plugins.js";
/**
 * 分类/标签页生成器：
 * - /categories/<父>/<子>/  分类文章列表（layout: category），支持子分类层级，含分页
 * - /tags/<name>/          标签文章列表（layout: tag），含分页
 *
 * 分类层级规则：每条分类路径的所有祖先也会生成页面（父分类页包含
 * 直接 + 间接子分类的文章，与 Hexo 行为一致）。
 */
export default function (api: GeneratorAPI): void;
