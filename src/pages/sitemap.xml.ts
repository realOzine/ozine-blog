import type { APIContext } from 'astro'
import { formatDate, getPosts } from '../lib/posts'

// 首页、项目页和全部文章。文章的 lastmod 取更新日期，没有就取发布日期；slug 只含小写字母、数字和连字符，不用转义。
export async function GET({ site: origin }: APIContext) {
  const url = (path: string, lastmod?: Date) =>
    `<url><loc>${new URL(path, origin).href}</loc>${lastmod ? `<lastmod>${formatDate(lastmod)}</lastmod>` : ''}</url>`
  const urls = [
    url('/'),
    url('/projects/'),
    ...(await getPosts()).map((post) => url(`/posts/${post.id}/`, post.data.updated ?? post.data.date)),
  ]
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
