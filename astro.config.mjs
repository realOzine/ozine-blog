import fs from 'node:fs'
import { satteri } from '@astrojs/markdown-satteri'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import { markdownFeatures } from './src/lib/markdown.ts'
import { publishedDir } from './src/lib/published.ts'
import { callout } from './src/plugins/callout.ts'
import { headingAnchor } from './src/plugins/heading-anchor.ts'
import { math } from './src/plugins/math.ts'

// 旧 slug → 新地址，由导出脚本根据 frontmatter 的 redirect_from 生成。
function readRedirects() {
  try {
    return JSON.parse(fs.readFileSync(`${publishedDir}/redirects.json`, 'utf8'))
  } catch {
    return {}
  }
}

export default defineConfig({
  site: 'https://ozine.me',
  trailingSlash: 'always',
  redirects: readRedirects(),
  markdown: {
    processor: satteri({ features: markdownFeatures, hastPlugins: [callout, headingAnchor, math] }),
    shikiConfig: {
      themes: { light: 'github-light-high-contrast', dark: 'material-theme-palenight' },
      // 不写死行内颜色，只输出 --shiki-light / --shiki-dark 变量，由 global.css 按明暗选择。
      defaultColor: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
    // 字体分片不内联成 base64：它们靠 unicode-range 按需下载，内联进样式表就变成人人都要下载。其它文件沿用默认规则。
    build: { assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined) },
  },
})
