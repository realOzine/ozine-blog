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
