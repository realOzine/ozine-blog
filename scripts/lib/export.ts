// 内容导出：读取 Obsidian 原稿 → 校验 metadata → 转换 Obsidian 语法 → 生成公开副本。
// 所有问题收集为 Issue 一次性报告；只要有一个 Issue，就不写入任何文件。

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri'
import { slug as slugify } from 'github-slugger'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

const STATUSES = ['draft', 'published', 'withdrawn'] as const
type Status = (typeof STATUSES)[number]

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'])
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const isImage = (name: string) => IMAGE_EXTS.has(path.extname(name).toLowerCase())
const DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?$/

export interface Issue {
  /** 相对内容目录的原稿路径 */
  file: string
  line?: number
  message: string
}

export interface ExportOptions {
  /** 内容目录（可以是软链接） */
  contentDir: string
  /** 输出目录，会被清空后重建 */
  outDir: string
}

export interface ExportResult {
  issues: Issue[]
  /** 已导出文章的 slug */
  posts: string[]
  assets: string[]
  skipped: { draft: number; withdrawn: number }
}

type RenderMarkdown = Awaited<ReturnType<typeof createSatteriMarkdownProcessor>>['render']

interface Heading {
  /** 用于匹配 `[[文章#标题]]`：忽略大小写、标点和强调标记 */
  key: string
  text: string
  anchor: string
}

interface Note {
  /** 相对内容目录、以 `/` 分隔 */
  file: string
  abs: string
  data: Record<string, unknown>
  body: string
  /** 正文第一行在原文件中的行号 */
  bodyLine: number
  /** frontmatter 无法解析时的错误信息 */
  yamlError?: string
  status?: Status
  /** 仅当 status 为 published 且 metadata 全部合法时为 true */
  publishable: boolean
  headings?: Heading[]
}

export async function exportContent(options: ExportOptions): Promise<ExportResult> {
  const issues: Issue[] = []
  if (!fs.existsSync(options.contentDir)) {
    issues.push({ file: options.contentDir, message: '内容目录不存在（content 软链接是否已建立？）' })
    return { issues, posts: [], assets: [], skipped: { draft: 0, withdrawn: 0 } }
  }
  // 取真实路径：原稿里的 `../../90 system/attachments/x.webp` 要相对库内的真实位置解析。
  const contentRoot = fs.realpathSync(options.contentDir)

  const notes = walk(contentRoot, (name) => name.endsWith('.md')).map((abs) => readNote(abs, contentRoot))
  for (const note of notes) validateMetadata(note, issues)

  const published = notes.filter((n) => n.publishable)
  const result: ExportResult = {
    issues,
    posts: [],
    assets: [],
    skipped: {
      draft: notes.filter((n) => n.status === 'draft').length,
      withdrawn: notes.filter((n) => n.status === 'withdrawn').length,
    },
  }

  const redirects = checkSlugs(published, issues)

  // 标题锚点直接取自 Astro 使用的 Markdown 处理器，而不是自己解析，保证与线上的标题 id 一致。
  // 这里的处理器选项要与 astro.config.mjs 中 satteri() 的 features 保持一致（目前都是默认值）。
  const { render } = await createSatteriMarkdownProcessor({ syntaxHighlight: false })
  await Promise.all(published.map((note) => readHeadings(note, notes, render)))

  const assets = new AssetRegistry(contentRoot, findVaultRoot(contentRoot))
  const outputs = published.map((note) => {
    const body = transformBody(note, { notes, assets, issues })
    return { slug: note.data.slug as string, text: `---\n${stringifyYaml(publicFrontmatter(note))}---\n${body}` }
  })

  if (issues.length > 0) return result

  fs.rmSync(options.outDir, { recursive: true, force: true })
  fs.mkdirSync(path.join(options.outDir, 'posts'), { recursive: true })
  fs.mkdirSync(path.join(options.outDir, 'assets'), { recursive: true })
  for (const { slug, text } of outputs) {
    fs.writeFileSync(path.join(options.outDir, 'posts', `${slug}.md`), text)
    result.posts.push(slug)
  }
  for (const [name, src] of assets.entries()) {
    fs.copyFileSync(src, path.join(options.outDir, 'assets', name))
    result.assets.push(name)
  }
  fs.writeFileSync(path.join(options.outDir, 'redirects.json'), JSON.stringify(redirects, null, 2) + '\n')
  return result
}

export function formatIssue(issue: Issue): string {
  return `${issue.file}${issue.line ? `:${issue.line}` : ''}  ${issue.message}`
}

export function formatIssues(issues: Issue[]): string {
  return [`发现 ${issues.length} 个问题：`, '', ...issues.map((issue) => `  ${formatIssue(issue)}`)].join('\n')
}

export function formatSummary(result: ExportResult): string {
  const { posts, assets, skipped } = result
  return `${posts.length} 篇文章、${assets.length} 个附件（跳过草稿 ${skipped.draft} 篇、已撤回 ${skipped.withdrawn} 篇）`
}

// ---------- 读取与校验 ----------

function findVaultRoot(from: string): string | undefined {
  for (let dir = from; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.obsidian'))) return dir
    if (dir === path.dirname(dir)) return undefined
  }
}

function walk(dir: string, accept: (name: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return []
  const found: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...walk(abs, accept))
    else if (entry.isFile() && accept(entry.name)) found.push(abs)
  }
  return found.sort()
}

function readNote(abs: string, contentRoot: string): Note {
  const raw = fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n')
  const file = path.relative(contentRoot, abs).split(path.sep).join('/')
  const note: Note = { file, abs, data: {}, body: raw, bodyLine: 1, publishable: false }
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(raw)
  if (!match) return note
  note.body = raw.slice(match[0].length)
  note.bodyLine = match[0].split('\n').length
  try {
    const data = parseYaml(match[1])
    if (data && typeof data === 'object' && !Array.isArray(data)) note.data = data
  } catch (error) {
    note.yamlError = (error as Error).message.split('\n')[0]
  }
  return note
}

function validateMetadata(note: Note, issues: Issue[]): void {
  const before = issues.length
  const report = (message: string) => issues.push({ file: note.file, message })
  const { data } = note

  if (note.yamlError) return void report(`frontmatter 不是合法的 YAML：${note.yamlError}`)

  if (data.status === undefined) return void report(`缺少 status（可选值：${STATUSES.join(' / ')}）`)
  if (!STATUSES.includes(data.status as Status)) {
    return void report(`非法的 status「${String(data.status)}」（可选值：${STATUSES.join(' / ')}）`)
  }
  note.status = data.status as Status
  // 草稿和已撤回的文章不公开，不要求其余字段完整。
  if (note.status !== 'published') return

  if (typeof data.title !== 'string' || data.title.trim() === '') report('缺少 title')
  if (typeof data.slug !== 'string') report('缺少 slug')
  else if (!SLUG_RE.test(data.slug)) report(`slug「${data.slug}」不合法：只能使用小写英文、数字和连字符`)
  if (typeof data.date !== 'string' || !DATE_RE.test(data.date) || Number.isNaN(Date.parse(data.date))) {
    report('缺少 date 或格式不合法（应为 YYYY-MM-DD）')
  }
  if (data.updated !== undefined && (typeof data.updated !== 'string' || !DATE_RE.test(data.updated))) {
    report('updated 格式不合法（应为 YYYY-MM-DD）')
  }
  if (data.tags !== undefined && data.tags !== null) {
    if (!Array.isArray(data.tags) || data.tags.some((t) => typeof t !== 'string' || t.trim() === '')) {
      report('tags 应为字符串列表')
    } else if (data.tags.some((t: string) => /[\/\s#]/.test(t))) {
      report('tags 不能包含空格、「/」或「#」（首版不支持嵌套标签）')
    }
  }
  if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
    report('description 应为字符串')
  }
  const redirectFrom = toList(data.redirect_from)
  if (!redirectFrom || redirectFrom.some((s) => typeof s !== 'string' || !SLUG_RE.test(s))) {
    report('redirect_from 应为旧 slug 或旧 slug 的列表')
  }
  note.publishable = issues.length === before
}

function toList(value: unknown): unknown[] | undefined {
  if (value === undefined || value === null) return []
  if (typeof value === 'string') return [value]
  return Array.isArray(value) ? value : undefined
}

/** 检查 slug 与 redirect_from 的全站唯一性，返回「旧地址 → 新地址」表。 */
function checkSlugs(published: Note[], issues: Issue[]): Record<string, string> {
  // 先登记全部 slug，再登记 redirect_from：两者共用同一个地址空间。
  const taken = new Map<string, Note>()
  for (const note of published) {
    const slug = note.data.slug as string
    const other = taken.get(slug)
    if (other) issues.push({ file: note.file, message: `slug「${slug}」与 ${other.file} 重复` })
    else taken.set(slug, note)
  }
  const redirects: Record<string, string> = {}
  for (const note of published) {
    for (const old of toList(note.data.redirect_from) as string[]) {
      const other = taken.get(old)
      if (other) {
        issues.push({ file: note.file, message: `redirect_from「${old}」与 ${other.file} 的地址冲突` })
        continue
      }
      taken.set(old, note)
      redirects[`/posts/${old}/`] = `/posts/${note.data.slug}/`
    }
  }
  return Object.fromEntries(Object.entries(redirects).sort(([a], [b]) => a.localeCompare(b)))
}

/** 只输出白名单字段：原稿中其它属性（status、Obsidian 私有属性等）不进入公开仓库。 */
function publicFrontmatter(note: Note): Record<string, unknown> {
  const { title, date, updated, tags, description } = note.data
  const out: Record<string, unknown> = { title, date }
  if (updated) out.updated = updated
  if (Array.isArray(tags) && tags.length > 0) out.tags = tags
  if (typeof description === 'string' && description.trim() !== '') out.description = description
  return out
}

// ---------- 双链解析 ----------

/** 按 Obsidian 的习惯解析：不带路径时按文件名匹配，带路径时按路径后缀匹配，不区分大小写。 */
function findNotes(notes: Note[], target: string): Note[] {
  const name = target.replace(/\.md$/i, '').toLowerCase()
  return notes.filter((n) => {
    const file = n.file.replace(/\.md$/i, '').toLowerCase()
    return file === name || file.endsWith(`/${name}`)
  })
}

/**
 * 逐行调用；当前行是代码围栏的起止行或位于围栏内时返回 true。
 * 按 CommonMark：结束围栏必须与开始围栏同字符、长度不短于它，且后面没有其它内容。
 */
function fenceTracker(): (line: string) => boolean {
  let open: string | undefined
  return (line) => {
    const match = /^\s*(?:>\s*)*(`{3,}|~{3,})(.*)$/.exec(line)
    if (!match) return open !== undefined
    const [, marks, rest] = match
    if (!open) open = marks
    else if (marks[0] === open[0] && marks.length >= open.length && rest.trim() === '') open = undefined
    return true
  }
}

/**
 * 逐行处理正文：代码围栏与行内代码原样保留，去掉 %%注释%%，其余文字交给 mapText。
 * 正文转换与标题提取共用这一遍扫描，两者看到的是同一份「可见文字」。
 */
function mapBody(body: string, mapText: (text: string, lineIndex: number) => string): string {
  const inCode = fenceTracker()
  let inComment = false

  return body
    .split('\n')
    .map((line, index) => {
      if (!inComment && inCode(line)) return line

      // 把一行切成「行内代码」和「其余文字」。双链整体算作文字，即使里面带反引号（`[[文章#`code` 标题]]`）。
      const parts = line.split(/(!?\[\[[^\]\n]+?\]\]|(`+)[^`]*?\2)/)
      let text = ''
      let segment = ''
      const flush = () => {
        text += mapText(segment, index)
        segment = ''
      }
      for (let i = 0; i < parts.length; i += 3) {
        for (const [j, piece] of parts[i].split('%%').entries()) {
          if (j > 0) inComment = !inComment
          if (!inComment) segment += piece
        }
        const token = parts[i + 1]
        if (token === undefined || inComment) continue
        if (parts[i + 2] === undefined) segment += token
        else {
          flush()
          text += token
        }
      }
      flush()
      return text
    })
    .join('\n')
}

interface LinkParts {
  /** 目标文章；空字符串表示本篇 */
  name: string
  heading?: string
  alias?: string
}

function parseLink(inner: string): LinkParts {
  const [targetPart, alias] = splitAlias(inner)
  const hashIndex = targetPart.indexOf('#')
  if (hashIndex === -1) return { name: targetPart.trim(), alias }
  return { name: targetPart.slice(0, hashIndex).trim(), heading: targetPart.slice(hashIndex + 1).trim(), alias }
}

/** 双链的显示文字：别名 > 标题锚点 > 目标文章的 title（而不是文件名，文件名是私有的组织方式）。 */
function linkLabel(link: LinkParts, target: Note, headingText: string | undefined): string {
  const title = String(target.data.title)
  const label = link.alias ?? (link.name === '' ? (headingText ?? title) : headingText ? `${title} › ${headingText}` : title)
  return label.replace(/[[\]]/g, '\\$&')
}

function headingKey(text: string): string {
  // github-slugger 会去掉 `*`、反引号等标点但保留下划线，这里一并去掉，让 `_强调_` 也能匹配。
  return slugify(text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')).replace(/_/g, '')
}

/**
 * 提取一篇文章渲染后的标题及其 id。
 * 输入必须与公开副本「看起来一样」：注释已删除，标题里的双链已换成显示文字。
 * 此时其它文章的标题还未就绪，所以带锚点的双链先用链接里写的标题文字，只影响极少见的「标题里链接到另一个标题」。
 */
async function readHeadings(note: Note, notes: Note[], render: RenderMarkdown): Promise<void> {
  const source = mapBody(note.body, (text) =>
    text.replace(/(!?)\[\[([^\]\n]+?)\]\]/g, (original, bang: string, inner: string) => {
      if (bang) return `![${imageAlt(splitAlias(inner)[1])}](x)`
      const link = parseLink(inner)
      const matches = link.name === '' ? [note] : findNotes(notes, link.name)
      // 无法解析的双链会在正文转换时报错，这里保持原样即可。
      return matches.length === 1 && matches[0].publishable ? linkLabel(link, matches[0], link.heading) : original
    }),
  )
  const { metadata } = await render(source)
  note.headings = metadata.headings.map(({ text, slug }) => ({ text: text.trim(), anchor: slug, key: headingKey(text) }))
}

/** `![[a.png|300]]` 的尺寸在首版被忽略；非数字别名作为替代文字。 */
function imageAlt(alias: string | undefined): string {
  return alias && !/^\d+(x\d+)?$/.test(alias) ? alias : ''
}

function splitAlias(inner: string): [string, string | undefined] {
  // 表格里的别名分隔符会写成 `\|`
  const index = inner.search(/\\?\|/)
  if (index === -1) return [inner.trim(), undefined]
  return [inner.slice(0, index).trim(), inner.slice(index).replace(/^\\?\|/, '').trim()]
}

// ---------- 附件 ----------

class AssetRegistry {
  private used = new Map<string, string>()
  private byName: Map<string, string[]> | undefined
  private contentRoot: string
  private vaultRoot: string | undefined
  private boundary: string

  constructor(contentRoot: string, vaultRoot: string | undefined) {
    this.contentRoot = contentRoot
    this.vaultRoot = vaultRoot
    // 附件必须位于库内；找不到库根目录时退回到内容目录。
    this.boundary = vaultRoot ?? contentRoot
  }

  entries(): [string, string][] {
    return [...this.used.entries()].sort(([a], [b]) => a.localeCompare(b))
  }

  /** 解析原稿中的图片引用，登记为待导出附件，返回导出后的文件名；失败时返回错误信息。 */
  resolve(target: string, note: Note): { name: string } | { error: string } {
    if (!isImage(target)) {
      return { error: `不支持的附件类型「${target}」（仅导出图片：${[...IMAGE_EXTS].join(' ')}）` }
    }
    const candidates = this.candidates(target, note)
    if (candidates.length === 0) return { error: `找不到附件「${target}」` }
    if (candidates.length > 1) {
      const list = candidates.map((c) => path.relative(this.boundary, c)).join('、')
      return { error: `附件「${target}」有多个同名文件，请写明路径：${list}` }
    }
    const src = fs.realpathSync(candidates[0])
    if (path.relative(this.boundary, src).startsWith('..')) {
      return { error: `附件「${target}」位于 Obsidian 库之外，拒绝导出` }
    }
    return { name: this.register(src) }
  }

  private candidates(target: string, note: Note): string[] {
    const isFile = (p: string) => fs.existsSync(p) && fs.statSync(p).isFile()
    // 1. 相对原稿所在目录；2. 相对库根目录；3. 仅文件名时，在附件目录与内容目录中按名查找。
    const direct = [path.resolve(path.dirname(note.abs), target)]
    if (this.vaultRoot) direct.push(path.resolve(this.vaultRoot, target.replace(/^\/+/, '')))
    const hit = direct.find(isFile)
    if (hit) return [hit]
    if (target.includes('/')) return []
    return this.index().get(target.toLowerCase()) ?? []
  }

  private index(): Map<string, string[]> {
    if (this.byName) return this.byName
    const dirs = new Set([this.contentRoot])
    if (this.vaultRoot) {
      const folder = readAttachmentFolder(this.vaultRoot)
      if (folder) dirs.add(path.resolve(this.vaultRoot, folder))
    }
    this.byName = new Map()
    for (const dir of dirs) {
      for (const abs of walk(dir, isImage)) {
        const key = path.basename(abs).toLowerCase()
        const list = this.byName.get(key) ?? []
        if (!list.includes(abs)) this.byName.set(key, [...list, abs])
      }
    }
    return this.byName
  }

  private register(src: string): string {
    const ext = path.extname(src).toLowerCase()
    const stem = path.basename(src, path.extname(src)).replace(/[\s()[\]<>#?%"'\\]+/g, '-')
    let name = `${stem}${ext}`
    const existing = this.used.get(name)
    if (existing && existing !== src) {
      // 不同目录下的同名文件：用内容哈希区分，保证导出结果稳定。
      const hash = crypto.createHash('sha1').update(fs.readFileSync(src)).digest('hex').slice(0, 8)
      name = `${stem}-${hash}${ext}`
    }
    this.used.set(name, src)
    return name
  }
}

function readAttachmentFolder(vaultRoot: string): string | undefined {
  try {
    const app = JSON.parse(fs.readFileSync(path.join(vaultRoot, '.obsidian', 'app.json'), 'utf8'))
    const folder = app.attachmentFolderPath
    // `./xxx` 表示「原稿同级目录」，已由相对原稿的查找覆盖。
    return typeof folder === 'string' && folder !== '/' && !folder.startsWith('./') ? folder : undefined
  } catch {
    return undefined
  }
}

// ---------- 正文转换 ----------

interface TransformContext {
  notes: Note[]
  assets: AssetRegistry
  issues: Issue[]
}

const INLINE_RE =
  /!\[\[([^\]\n]+?)\]\]|\[\[([^\]\n]+?)\]\]|!\[([^\]]*)\]\((<[^>\n]+>|[^)\s]+)(\s+"[^"]*")?\)|(?<!!)\[[^\]]*\]\(([^)\s]+)\)/g

function transformBody(note: Note, ctx: TransformContext): string {
  return mapBody(note.body, (text, index) => transformInline(text, note, note.bodyLine + index, ctx))
}

function transformInline(text: string, note: Note, line: number, ctx: TransformContext): string {
  return text.replace(INLINE_RE, (original, embed, link, mdAlt, mdDest, mdTitle, mdLink) => {
    /** 记录问题，并让原文保持不变。 */
    const fail = (message: string): string => {
      ctx.issues.push({ file: note.file, line, message })
      return original
    }
    const image = (target: string, alt: string, title = ''): string => {
      const resolved = ctx.assets.resolve(target, note)
      return 'error' in resolved ? fail(resolved.error) : `![${alt}](../assets/${resolved.name}${title})`
    }

    if (embed !== undefined) {
      const [target, alias] = splitAlias(embed)
      if (!isImage(target)) return fail(`不支持嵌入「${target}」：首版只支持 ![[图片]]，不支持笔记嵌入`)
      return image(target, imageAlt(alias))
    }

    if (link !== undefined) return wikilink(link, note, ctx.notes, fail)

    const dest = safeDecode((mdDest ?? mdLink).replace(/^<|>$/g, ''))
    if (/^[a-z][a-z0-9+.-]*:|^\/\/|^#/i.test(dest)) return original
    if (mdDest !== undefined) return image(dest.replace(/[?#].*$/, ''), mdAlt, mdTitle ?? '')
    if (/\.md(#.*)?$/i.test(dest)) return fail(`指向笔记的 Markdown 链接「${dest}」无法转换，请改用 [[双链]]`)
    return original
  })
}

function wikilink(inner: string, note: Note, notes: Note[], fail: (message: string) => string): string {
  const link = parseLink(inner)
  const { name, heading } = link

  if (heading?.startsWith('^')) return fail(`不支持块引用「[[${inner}]]」`)

  let target = note
  if (name !== '') {
    const matches = findNotes(notes, name)
    if (matches.length === 0) return fail(`失效的双链「[[${name}]]」：博客目录中找不到这篇文章`)
    if (matches.length > 1) {
      return fail(`双链「[[${name}]]」有歧义，匹配到：${matches.map((m) => m.file).join('、')}`)
    }
    target = matches[0]
    if (!target.publishable) {
      return fail(`双链「[[${name}]]」指向未发布的文章 ${target.file}（status: ${target.status ?? '无效'}）`)
    }
  }

  let found: Heading | undefined
  if (heading) {
    const key = headingKey(heading)
    found = target.headings?.find((h) => h.key === key)
    if (!found) return fail(`双链「[[${inner}]]」：${target.file} 中找不到标题「${heading}」`)
  }

  const anchor = found ? `#${found.anchor}` : ''
  const url = name === '' ? anchor : `/posts/${target.data.slug}/${anchor}`
  // 显示文字用标题渲染后的文字，而不是链接里写的原文（可能带 `**`、大小写也可能不同）。
  return `[${linkLabel(link, target, found?.text)}](${url})`
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
