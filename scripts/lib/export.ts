// 内容导出：读取 Obsidian 原稿 → 校验 metadata → 转换 Obsidian 语法 → 生成公开副本。
// 所有问题收集为 Issue 一次性报告；只要有一个 Issue，就不写入任何文件。

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import GithubSlugger from 'github-slugger'
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

interface Heading {
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

export function exportContent(options: ExportOptions): ExportResult {
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

/** 逐行调用；当前行是代码围栏的起止行或位于围栏内时返回 true。 */
function fenceTracker(): (line: string) => boolean {
  let fence: string | undefined
  return (line) => {
    const match = /^\s*(?:>\s*)*(`{3,}|~{3,})/.exec(line)
    if (!match) return fence !== undefined
    if (!fence) fence = match[1][0]
    else if (match[1][0] === fence) fence = undefined
    return true
  }
}

function headingsOf(note: Note): Heading[] {
  if (note.headings) return note.headings
  // 与 Astro 生成标题 id 的方式保持一致：同一篇内按出现顺序用 github-slugger 去重。
  const slugger = new GithubSlugger()
  const headings: Heading[] = []
  const inCode = fenceTracker()
  for (const line of note.body.split('\n')) {
    if (inCode(line)) continue
    const match = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) continue
    const text = plainText(match[1])
    headings.push({ text, anchor: slugger.slug(text) })
  }
  return (note.headings = headings)
}

/** 标题的纯文本：去掉双链、链接和强调标记，近似渲染后的文字。 */
function plainText(markdown: string): string {
  return markdown
    .replace(/!?\[\[([^\]]+)\]\]/g, (_, inner: string) => {
      const [target, alias] = splitAlias(inner)
      return alias ?? target
    })
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`|\*\*|\*|~~|==/g, '')
    .trim()
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
  const inCode = fenceTracker()
  let inComment = false

  return note.body
    .split('\n')
    .map((line, index) => {
      if (!inComment && inCode(line)) return line

      // 行内代码原样保留，其余片段去掉 %%注释%% 后再转换。
      const parts = line.split(/((`+)[^`]*?\2)/)
      let text = ''
      for (let i = 0; i < parts.length; i += 3) {
        let segment = ''
        for (const [j, piece] of parts[i].split('%%').entries()) {
          if (j > 0) inComment = !inComment
          if (!inComment) segment += piece
        }
        text += transformInline(segment, note, note.bodyLine + index, ctx)
        if (parts[i + 1] !== undefined && !inComment) text += parts[i + 1]
      }
      return text
    })
    .join('\n')
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
      // `![[a.png|300]]` 的尺寸在首版被忽略；非数字别名作为替代文字。
      return image(target, alias && !/^\d+(x\d+)?$/.test(alias) ? alias : '')
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
  const [targetPart, alias] = splitAlias(inner)
  const hashIndex = targetPart.indexOf('#')
  const name = (hashIndex === -1 ? targetPart : targetPart.slice(0, hashIndex)).trim()
  const heading = hashIndex === -1 ? undefined : targetPart.slice(hashIndex + 1).trim()

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

  let anchor = ''
  if (heading) {
    const wanted = plainText(heading).toLowerCase()
    const found = headingsOf(target).find((h) => h.text.toLowerCase() === wanted)
    if (!found) return fail(`双链「[[${inner}]]」：${target.file} 中找不到标题「${heading}」`)
    anchor = `#${found.anchor}`
  }

  // 显示文字：别名 > 标题锚点 > 目标文章的 title（而不是文件名，文件名是私有的组织方式）。
  const label = alias ?? (name === '' ? heading! : heading ? `${target.data.title} › ${heading}` : target.data.title)
  const url = name === '' ? anchor : `/posts/${target.data.slug}/${anchor}`
  return `[${String(label).replace(/[[\]]/g, '\\$&')}](${url})`
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
