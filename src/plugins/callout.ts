// Obsidian Callout：把以 `[!type]` 开头的引用块渲染为提示块。
//
//   > [!tip] 标题            <div class="callout" data-callout="tip">
//   > 正文            →        <p class="callout-title">标题</p>
//                              <p>正文</p>
//                            </div>
//
// 带折叠标记（`[!tip]-` / `[!tip]+`）时输出 <details>/<summary>。
// 限制：标题只支持纯文本。

import type { Element, ElementContent } from 'hast'

const MARKER = /^\[!([\w-]+)\]([+-]?)[ \t]*([^\n]*)(?:\n([\s\S]*))?$/

const LABELS: Record<string, string> = {
  note: '备注',
  info: '信息',
  tip: '提示',
  hint: '提示',
  important: '重要',
  success: '完成',
  question: '问题',
  warning: '注意',
  caution: '注意',
  danger: '危险',
  error: '错误',
  bug: '缺陷',
  example: '示例',
  quote: '引用',
  abstract: '摘要',
  summary: '摘要',
  todo: '待办',
}

function transform(node: Readonly<Element>): Element | undefined {
  const paragraphIndex = node.children.findIndex((child) => child.type === 'element')
  const paragraph = node.children[paragraphIndex]
  if (paragraph?.type !== 'element' || paragraph.tagName !== 'p') return
  const first = paragraph.children[0]
  if (first?.type !== 'text') return
  const match = MARKER.exec(first.value)
  if (!match) return

  const [, rawType, fold, rawTitle, rest] = match
  const type = rawType.toLowerCase()
  const title = rawTitle.trim() || LABELS[type] || rawType

  const bodyInline: ElementContent[] = paragraph.children.slice(1)
  if (rest) bodyInline.unshift({ type: 'text', value: rest })
  const body: ElementContent[] = node.children.slice(paragraphIndex + 1)
  if (bodyInline.length > 0) {
    body.unshift({ type: 'element', tagName: 'p', properties: {}, children: bodyInline })
  }

  const titleNode: Element = {
    type: 'element',
    tagName: fold ? 'summary' : 'p',
    properties: { className: ['callout-title'] },
    children: [{ type: 'text', value: title }],
  }
  return {
    type: 'element',
    tagName: fold ? 'details' : 'div',
    properties: { className: ['callout'], dataCallout: type, ...(fold === '+' ? { open: true } : {}) },
    children: [titleNode, ...body],
  }
}

export const callout = {
  name: 'obsidian-callout',
  element: {
    filter: ['blockquote'],
    visit: transform,
  },
}
