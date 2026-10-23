import type { APIContext } from 'astro'

// 全站允许抓取，只用来告诉爬虫 sitemap 在哪里。
export function GET({ site: origin }: APIContext) {
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', origin).href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
