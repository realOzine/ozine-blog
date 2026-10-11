// 标题锚点：在正文的二、三级标题后面加一个指向自己的 `#` 链接。
//
//   <h2>整体思路</h2>  →  <h2 id="整体思路">整体思路<a class="anchor" href="#整体思路" aria-label="Link to this section"></a></h2>
//
// id 不自己算：Astro 内置的标题 id 插件排在自定义插件之后，这里先调用同一个插件得到 id，
// 内置插件随后再跑时会沿用已有的 id，所以锚点、页面 id 和导出脚本算出的锚点始终一致。
// `#` 字符由 global.css 用 ::before 画出来，链接本身是空的：否则它会混进标题文字，进而出现在目录里。

import { satteriHeadingIdsPlugin } from '@astrojs/markdown-satteri'
import type { Element } from 'hast'
import type { HastVisitorContext } from 'satteri'

// 内置插件导出的类型是宽泛的「任意插件」，这里写出它实际的形状
interface HeadingIds {
  element: { filter: string[]; visit(node: Readonly<Element>, ctx: HastVisitorContext): void }
}

export const headingAnchor = () => {
  const ids = (satteriHeadingIdsPlugin() as () => HeadingIds)()
  return {
    name: 'heading-anchor',
    element: {
      // 所有级别都要经过内置插件，重复标题的序号才对得上
      filter: ids.element.filter,
      visit(node: Readonly<Element>, ctx: HastVisitorContext) {
        ids.element.visit(node, ctx)
        if (node.tagName !== 'h2' && node.tagName !== 'h3') return
        const astro = ctx.data.astro as { headings: { slug: string }[] } | undefined
        const slug = astro?.headings.at(-1)?.slug
        if (!slug) return
        ctx.appendChild(node, {
          type: 'element',
          tagName: 'a',
          properties: { className: ['anchor'], href: `#${slug}`, ariaLabel: 'Link to this section' },
          children: [],
        })
      },
    },
  }
}
