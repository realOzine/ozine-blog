import fs from 'node:fs'
import { satteri } from '@astrojs/markdown-satteri'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import { callout } from './src/plugins/callout.ts'

// 发布命令会把 PUBLISHED_DIR 指向临时导出目录，先构建检查、再更新 published/。
const publishedDir = process.env.PUBLISHED_DIR ?? './published'

// 旧 slug → 新地址，由导出脚本根据 frontmatter 的 redirect_from 生成。
function readRedirects() {
  try {
    return JSON.parse(fs.readFileSync(`${publishedDir}/redirects.json`, 'utf8'))
  } catch {
    return {}
  }
}

export default defineConfig({
  trailingSlash: 'always',
  redirects: readRedirects(),
  markdown: {
    processor: satteri({ hastPlugins: [callout] }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
