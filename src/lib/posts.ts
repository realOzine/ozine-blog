import { getCollection, type CollectionEntry } from 'astro:content'

export type Post = CollectionEntry<'posts'>

/** 首页和详情页都从这里取文章，保证公开范围一致。 */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts')
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf() || a.id.localeCompare(b.id))
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** 估算的阅读时长：按每分钟 400 字算，不足一分钟算一分钟。 */
export function readingMinutes(post: Post): number {
  return Math.max(1, Math.round((post.body?.length ?? 0) / 400))
}
