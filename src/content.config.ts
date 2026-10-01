import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const publishedDir = process.env.PUBLISHED_DIR ?? './published'

// 这里读取的是导出后的公开副本；文件名即 slug，status 已在导出时筛选过。
const posts = defineCollection({
  loader: glob({ pattern: '*.md', base: `${publishedDir}/posts` }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    description: z.string().optional(),
  }),
})

export const collections = { posts }
