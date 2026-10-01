import { getCollection, type CollectionEntry } from 'astro:content'

export type Post = CollectionEntry<'posts'>

export interface Tag {
  /** 用于网址的标识：小写后的标签名，大小写不同的写法归为同一个标签 */
  key: string
  label: string
  posts: Post[]
}

/** 首页、列表、标签和详情页都从这里取文章，保证公开范围一致。 */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts')
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf() || a.id.localeCompare(b.id))
}

export function tagKey(tag: string): string {
  return tag.toLowerCase()
}

export async function getTags(): Promise<Tag[]> {
  const tags = new Map<string, Tag>()
  for (const post of await getPosts()) {
    for (const label of post.data.tags) {
      const key = tagKey(label)
      const tag = tags.get(key) ?? { key, label, posts: [] }
      if (!tag.posts.includes(post)) tag.posts.push(post)
      tags.set(key, tag)
    }
  }
  return [...tags.values()].sort((a, b) => b.posts.length - a.posts.length || a.key.localeCompare(b.key))
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
