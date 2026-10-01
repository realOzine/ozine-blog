// 公开副本所在目录。发布命令通过 PUBLISHED_DIR 指向临时导出目录，先构建检查、再更新 published/。
// astro.config.mjs（重定向表）与 src/content.config.ts（文章集合）都从这里取。
export const publishedDir = process.env.PUBLISHED_DIR ?? './published'
