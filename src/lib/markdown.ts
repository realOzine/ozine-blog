import type { SatteriFeatures } from '@astrojs/markdown-satteri'

/**
 * Markdown 处理器的语法开关。站点（astro.config.mjs）和导出脚本（scripts/lib/export.ts）必须用同一份：
 * 标题里出现公式时，两边认不认它，算出来的标题 id 会不一样。
 */
export const markdownFeatures: SatteriFeatures = { math: true }
