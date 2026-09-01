import type { GeneratorAPI } from "../plugins.js";
/**
 * 归档生成器（参考 huzerovo scripts/generator/archive_page.js）：
 * - /archives/            全部文章按年份分组（layout: archives），含分页
 * - /archives/<year>/     单年归档（layout: archives）
 */
export default function (api: GeneratorAPI): void;
