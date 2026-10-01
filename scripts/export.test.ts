import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { exportContent, formatIssue } from './lib/export.ts'

const FIXTURE = path.resolve(import.meta.dirname, '../fixtures/vault')

/** 复制一份样本库到临时目录，可追加或覆盖文件（路径相对库根目录）。 */
function vault(files: Record<string, string> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-export-'))
  const root = path.join(dir, 'vault')
  fs.cpSync(FIXTURE, root, { recursive: true })
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), content)
  }
  const outDir = path.join(dir, 'out')
  const run = () => exportContent({ contentDir: path.join(root, '40 blog'), outDir })
  const read = (file: string) => fs.readFileSync(path.join(outDir, file), 'utf8')
  return { dir, root, outDir, run, read }
}

function post(frontmatter: string, body = '正文'): string {
  return `---\n${frontmatter.trim()}\n---\n\n${body}\n`
}

const published = (slug: string) => `title: 测试\nslug: ${slug}\nstatus: published\ndate: 2026-10-01`

/** 断言恰好有一个问题，且定位到指定文件并包含指定文字。 */
function assertIssue(v: ReturnType<typeof vault>, file: string, pattern: RegExp) {
  const { issues } = v.run()
  const text = issues.map(formatIssue).join('\n')
  assert.equal(issues.length, 1, text)
  assert.equal(issues[0].file, file)
  assert.match(issues[0].message, pattern)
  assert.equal(fs.existsSync(v.outDir), false, '有问题时不应写入任何文件')
}

test('只导出 published 的文章与其引用的附件', () => {
  const v = vault()
  const result = v.run()
  assert.deepEqual(result.issues, [])
  assert.deepEqual(fs.readdirSync(path.join(v.outDir, 'posts')).sort(), [
    'building-this-blog.md',
    'go-interfaces-vs-generics.md',
    'go-interfaces.md',
  ])
  // 草稿引用的 private-screenshot.png 不在其中
  assert.deepEqual(fs.readdirSync(path.join(v.outDir, 'assets')).sort(), ['interface-diagram.png', '发布-流程.webp'])
  assert.deepEqual(result.skipped, { draft: 1, withdrawn: 1 })
})

test('frontmatter 只保留白名单字段', () => {
  const v = vault()
  v.run()
  const text = v.read('posts/go-interfaces.md')
  assert.match(text, /^---\ntitle: 理解 Go 的接口\ndate: 2026-09-29\ntags:\n  - Go\ndescription: 从行为约束理解接口。\n---\n/)
  assert.doesNotMatch(text, /status|private_note|slug:/)
})

test('双链转换为站内链接：文章名、别名、标题锚点、页内锚点', () => {
  const v = vault()
  v.run()
  const text = v.read('posts/go-interfaces-vs-generics.md')
  assert.match(text, /- 文章名：\[理解 Go 的接口\]\(\/posts\/go-interfaces\/\)/)
  assert.match(text, /- 显示别名：\[上一篇文章\]\(\/posts\/go-interfaces\/\)/)
  assert.match(text, /- 标题锚点：\[理解 Go 的接口 › 类型断言\]\(\/posts\/go-interfaces\/#类型断言\)/)
  assert.match(text, /\| 表格里的别名 \| \[接口\]\(\/posts\/go-interfaces\/\) \|/)
  assert.match(v.read('posts/go-interfaces.md'), /回到\[隐式实现\]\(#隐式实现\)/)
})

test('图片：![[嵌入]] 与 Markdown 相对路径都改写到 ../assets/', () => {
  const v = vault()
  v.run()
  assert.match(v.read('posts/go-interfaces.md'), /!\[接口示意图\]\(\.\.\/assets\/interface-diagram\.png\)/)
  const text = v.read('posts/go-interfaces-vs-generics.md')
  assert.match(text, /!\[\]\(\.\.\/assets\/发布-流程\.webp\)/)
  assert.match(text, /!\[同一张图的第二次引用\]\(\.\.\/assets\/interface-diagram\.png\)/)
  assert.match(v.read('posts/building-this-blog.md'), /!\[外部图片\]\(https:\/\/astro\.build/)
})

test('代码块与行内代码保持原样，%%注释%% 被移除，Callout 语法保留', () => {
  const v = vault()
  v.run()
  const text = v.read('posts/go-interfaces.md')
  assert.match(text, /\/\/ 代码块里的 \[\[双链\]\] 和 !\[\[图片\.png\]\] 应保持原样/)
  assert.match(text, /`\[\[不是链接\]\]`/)
  assert.doesNotMatch(text, /只给自己看的注释|%%/)
  assert.match(text, /> \[!warning\] nil 接口的陷阱/)
  assert.doesNotMatch(v.read('posts/go-interfaces-vs-generics.md'), /还没想清楚|%%/)
})

test('redirect_from 生成重定向表', () => {
  const v = vault()
  v.run()
  assert.deepEqual(JSON.parse(v.read('redirects.json')), {
    '/posts/go-generics-old/': '/posts/go-interfaces-vs-generics/',
  })
})

test('撤回：再次导出后公开副本被移除', () => {
  const v = vault()
  v.run()
  const file = path.join(v.root, '40 blog/写作/博客搭建记录.md')
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('status: published', 'status: withdrawn'))
  // 另一篇文章链接到它，需一并去掉引用，否则会被「指向未发布文章」拦下
  const other = path.join(v.root, '40 blog/Go/接口与泛型.md')
  fs.writeFileSync(other, fs.readFileSync(other, 'utf8').replace('详见[[博客搭建记录]]。', ''))
  assert.deepEqual(v.run().issues, [])
  assert.equal(fs.existsSync(path.join(v.outDir, 'posts/building-this-blog.md')), false)
})

test('移动原稿、修改标题后，slug 不变则输出路径不变', () => {
  const v = vault()
  fs.renameSync(path.join(v.root, '40 blog/写作/博客搭建记录.md'), path.join(v.root, '40 blog/博客搭建记录.md'))
  assert.deepEqual(v.run().issues, [])
  assert.ok(fs.existsSync(path.join(v.outDir, 'posts/building-this-blog.md')))
})

test('通过软链接读取内容目录', () => {
  const v = vault()
  const link = path.join(v.dir, 'content')
  fs.symlinkSync(path.join(v.root, '40 blog'), link)
  const result = exportContent({ contentDir: link, outDir: v.outDir })
  assert.deepEqual(result.issues, [])
  assert.equal(result.posts.length, 3)
  assert.equal(result.assets.length, 2)
})

test('缺少 status', () => {
  assertIssue(vault({ '40 blog/a.md': '# 没有 frontmatter\n' }), 'a.md', /缺少 status/)
})

test('非法 status', () => {
  assertIssue(vault({ '40 blog/a.md': post('status: public') }), 'a.md', /非法的 status「public」/)
})

test('published 缺少必填字段时逐项报告', () => {
  const { issues } = vault({ '40 blog/a.md': post('status: published') }).run()
  assert.deepEqual(issues.map((i) => i.message.slice(0, 8)), ['缺少 title', '缺少 slug', '缺少 date '])
})

test('非法 slug', () => {
  assertIssue(vault({ '40 blog/a.md': post(published('Hello_World')) }), 'a.md', /slug「Hello_World」不合法/)
})

test('重复 slug', () => {
  assertIssue(vault({ '40 blog/a.md': post(published('go-interfaces')) }), 'a.md', /与 Go\/理解接口\.md 重复/)
})

test('redirect_from 与现有 slug 冲突', () => {
  const v = vault({ '40 blog/a.md': post(`${published('a')}\nredirect_from: go-interfaces`) })
  assertIssue(v, 'a.md', /redirect_from「go-interfaces」与 Go\/理解接口\.md 的地址冲突/)
})

test('失效的双链，报告行号', () => {
  const v = vault({ '40 blog/a.md': post(published('a'), '见[[不存在的文章]]') })
  assertIssue(v, 'a.md', /失效的双链「\[\[不存在的文章\]\]」/)
  assert.equal(v.run().issues[0].line, 8)
})

test('双链指向博客目录之外的笔记视为失效，不会公开目标', () => {
  assertIssue(vault({ '40 blog/a.md': post(published('a'), '[[私密笔记]]') }), 'a.md', /失效的双链/)
})

test('双链指向草稿', () => {
  const v = vault({ '40 blog/a.md': post(published('a'), '[[未完成的草稿]]') })
  assertIssue(v, 'a.md', /指向未发布的文章 drafts\/未完成的草稿\.md（status: draft）/)
})

test('双链重名歧义', () => {
  const v = vault({
    '40 blog/a.md': post(published('a'), '[[理解接口]]'),
    '40 blog/另一个目录/理解接口.md': post('status: draft'),
  })
  const { issues } = v.run()
  // 样本中原有的引用同样会变得有歧义
  assert.ok(issues.length >= 1)
  assert.ok(issues.every((i) => /有歧义，匹配到：.*Go\/理解接口\.md.*另一个目录\/理解接口\.md/.test(i.message)))
  assert.ok(issues.some((i) => i.file === 'a.md'))
})

test('双链的标题锚点不存在', () => {
  const v = vault({ '40 blog/a.md': post(published('a'), '[[理解接口#没有这个标题]]') })
  assertIssue(v, 'a.md', /找不到标题「没有这个标题」/)
})

test('不支持块引用与笔记嵌入', () => {
  assertIssue(vault({ '40 blog/a.md': post(published('a'), '[[理解接口#^abc123]]') }), 'a.md', /不支持块引用/)
  assertIssue(vault({ '40 blog/a.md': post(published('a'), '![[理解接口]]') }), 'a.md', /不支持笔记嵌入/)
})

test('缺失附件', () => {
  assertIssue(vault({ '40 blog/a.md': post(published('a'), '![[missing.png]]') }), 'a.md', /找不到附件「missing\.png」/)
  assertIssue(vault({ '40 blog/a.md': post(published('a'), '![x](./missing.png)') }), 'a.md', /找不到附件/)
})

test('附件重名歧义', () => {
  const v = vault({
    '40 blog/a.md': post(published('a'), '![[interface-diagram.png]]'),
    '40 blog/images/interface-diagram.png': 'another',
  })
  const { issues } = v.run()
  assert.ok(issues.length >= 1)
  assert.ok(issues.every((i) => /有多个同名文件/.test(i.message)))
})

test('笔记不能作为附件导出', () => {
  const v = vault({ '40 blog/a.md': post(published('a'), '![私密](../30%20domain/私密笔记.md)') })
  assertIssue(v, 'a.md', /不支持的附件类型/)
})

test('库之外的文件不能作为附件导出', () => {
  const v = vault({ '40 blog/a.md': post(published('a'), '![x](../../outside.png)') })
  fs.writeFileSync(path.join(v.dir, 'outside.png'), 'x')
  assertIssue(v, 'a.md', /位于 Obsidian 库之外/)
})

test('指向笔记的 Markdown 链接', () => {
  const v = vault({ '40 blog/a.md': post(published('a'), '[上一篇](Go/理解接口.md)') })
  assertIssue(v, 'a.md', /请改用 \[\[双链\]\]/)
})
