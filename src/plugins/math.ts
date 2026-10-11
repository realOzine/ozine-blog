// 数学公式：把 Markdown 处理器标出来的公式在构建时用 KaTeX 渲染成 HTML，浏览器里不运行脚本。
//
//   $a^2$          <code class="language-math math-inline">a^2</code>      →  <span class="katex">…</span>
//   $$ … $$        <pre><code class="language-math math-display">…</code></pre>  →  <span class="katex-display">…</span>
//
// 公式要先被处理器认出来：astro.config.mjs 和导出脚本共用 src/lib/markdown.ts 里的 features（math: true）。
// 公式写错时 KaTeX 会抛错，构建失败，而不是把坏公式发布出去。
// 排版靠 KaTeX 的样式表和字体，在 src/layouts/Base.astro 里引入；只让浏览器自己排 MathML 的话，求和上下标、矩阵括号、多行对齐都排不好。

import type { Element } from 'hast'
import katex from 'katex'
import type { HastVisitorContext } from 'satteri'

const isMath = (node: Element['children'][number] | undefined): node is Element =>
  node?.type === 'element' &&
  node.tagName === 'code' &&
  Array.isArray(node.properties?.className) &&
  node.properties.className.includes('language-math')

const render = (node: Element, ctx: HastVisitorContext, displayMode: boolean) =>
  katex.renderToString(ctx.textContent(node), { displayMode })

export const math = {
  name: 'math',
  element: {
    filter: ['pre', 'code'],
    visit(node: Readonly<Element>, ctx: HastVisitorContext) {
      if (node.tagName === 'pre') {
        const code = node.children[0]
        if (isMath(code)) ctx.replaceNode(node, { type: 'raw', value: render(code, ctx, true) })
        return
      }
      // 块级公式的 <code> 已随 <pre> 一起替换，这里只剩行内的
      const parent = ctx.parent(node)
      const inPre = parent.type === 'element' && parent.tagName === 'pre'
      if (isMath(node) && !inPre) ctx.replaceNode(node, { type: 'raw', value: render(node, ctx, false) })
    },
  },
}
