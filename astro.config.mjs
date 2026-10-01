import fs from 'node:fs'
import { satteri } from '@astrojs/markdown-satteri'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import { publishedDir } from './src/lib/published.ts'
import { callout } from './src/plugins/callout.ts'

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
      // 不写死行内颜色，只输出 --shiki-light / --shiki-dark 变量，由 global.css 按明暗选择。
      defaultColor: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
