// Mermaid 图：构建时用 beautiful-mermaid 渲染成内联 SVG，浏览器里不运行脚本。
//
//   ```mermaid           <pre><code class="language-mermaid">…</code></pre>  →  <figure class="mermaid"><svg>…</svg></figure>
//
// 颜色传的是站点的 token（var(--color-…)），明暗切换跟着 light-dark() 走，不用渲染两份。
// 库会在 SVG 里塞一行 Google Fonts 的 @import，这里删掉：字体由 global.css 指定为正文字体。
// 尺寸改成 em：库按 13px 字号排版，这里让 13px 对应正文的 0.9em（和代码块同大），宁可横向滚动也不缩小文字。
// 图写错时库会抛错，构建失败，而不是把坏图发布出去。

import { renderMermaidSVG } from 'beautiful-mermaid'
import type { Element } from 'hast'
import type { HastVisitorContext } from 'satteri'

const isMermaid = (node: Element['children'][number] | undefined): node is Element =>
  node?.type === 'element' &&
  node.tagName === 'code' &&
  Array.isArray(node.properties?.className) &&
  node.properties.className.includes('language-mermaid')

const render = (source: string) =>
  renderMermaidSVG(source, {
    bg: 'var(--color-page)',
    fg: 'var(--color-body)',
    line: 'var(--color-muted)',
    accent: 'var(--color-body)',
    muted: 'var(--color-muted)',
    surface: 'var(--color-surface)',
    border: 'var(--color-muted)',
    transparent: true,
    padding: 2, // 默认 40px 会让图比正文缩进一截，留 2px 免得边框被裁掉
  })
    .replace(/^\s*@import url\([^)]*\);\n/gm, '')
    .replace(/ width="([\d.]+)" height="([\d.]+)"/, (_, w, h) => ` width="${em(w)}" height="${em(h)}"`)

const em = (px: string) => `${((Number(px) / 13) * 0.9).toFixed(3)}em`

export const mermaid = {
  name: 'mermaid',
  element: {
    filter: ['pre'],
    visit(node: Readonly<Element>, ctx: HastVisitorContext) {
      const code = node.children[0]
      if (isMermaid(code))
        ctx.replaceNode(node, { type: 'raw', value: `<figure class="mermaid">${render(ctx.textContent(code))}</figure>` })
    },
  },
}
