import type { APIContext } from 'astro'
import { getPosts } from '../lib/posts'
import { site } from '../site.config'

// RSS 2.0。只放标题、链接、日期和摘要，不放全文：全文要渲染 Markdown，阅读器点进来看网页即可。
const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function GET({ site: origin }: APIContext) {
  const home = origin!.href
  const items = (await getPosts()).map((post) => {
    const link = new URL(`/posts/${post.id}/`, origin).href
    return `<item>
<title>${escape(post.data.title)}</title>
<link>${link}</link>
<guid>${link}</guid>
<pubDate>${post.data.date.toUTCString()}</pubDate>${post.data.description ? `\n<description>${escape(post.data.description)}</description>` : ''}
</item>`
  })
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${escape(site.title)}</title>
<link>${home}</link>
<description>${escape(site.description)}</description>
<language>zh-CN</language>
<atom:link href="${new URL('/rss.xml', origin).href}" rel="self" type="application/rss+xml"/>
${items.join('\n')}
</channel>
</rss>
`
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
}
