import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { exportContent, formatIssue } from './lib/export.ts'

function lines(...content: string[]): string {
  return content.join('\n') + '\n'
}

// 测试用的最小 Obsidian 库：结构与真实库一致（博客目录、库外附件目录、库外私密笔记）。
// 每个测试把它写入系统临时目录，仓库里不保存样本文章。
const BASE: Record<string, string> = {
  '.obsidian/app.json': '{ "attachmentFolderPath": "90 system/attachments" }',
  '30 domain/私密笔记.md': lines(
    '# 私密笔记',
    '',
    '这篇笔记在博客目录之外，任何情况下都不应出现在公开副本里。',
  ),
  '40 blog/Go/接口与泛型.md': lines(
    '---',
    'title: 接口与泛型怎么选',
    'slug: go-interfaces-vs-generics',
    'status: published',
    'date: 2026-09-30',
    'updated: 2026-10-01',
    'tags:',
    '  - Go',
    '  - 泛型',
    'description: 什么时候用接口，什么时候用类型参数。',
    'redirect_from: go-generics-old',
    '---',
    '',
    '这篇是[[理解接口]]的续篇，默认你已经读过[[理解接口#接口值|接口值的结构]]。',
    '',
    '## 先回顾',
    '',
    '三种双链写法：',
    '',
    '- 文章名：[[理解接口]]',
    '- 显示别名：[[Go/理解接口|上一篇文章]]',
    '- 标题锚点：[[理解接口#类型断言]]',
    '',
    '| 写法 | 例子 |',
    '| --- | --- |',
    '| 表格里的别名 | [[理解接口\\|接口]] |',
    '',
    '## 一张图',
    '',
    '![[发布 流程.webp|480]]',
    '',
    '![[interface-diagram.png|同一张图的第二次引用]]',
    '',
    '%%',
    '多行注释：',
    '这里记了一些还没想清楚的东西，不应公开。',
    '%%',
    '',
    '## 结论',
    '',
    '> [!important] 经验法则',
    '> 需要**行为多态**用接口，需要**类型保持**用泛型。详见[[博客搭建记录]]。',
  ),
  '40 blog/Go/理解接口.md': lines(
    '---',
    'title: 理解 Go 的接口',
    'slug: go-interfaces',
    'status: published',
    'date: 2026-09-29',
    'tags:',
    '  - Go',
    'description: 从行为约束理解接口。',
    'private_note: 这个字段不应出现在公开副本里',
    '---',
    '',
    'Go 的接口描述的是**行为**，而不是数据。%%这是只给自己看的注释，不应公开%%',
    '',
    '> [!note]',
    '> 接口是隐式实现的：类型不需要声明自己实现了哪个接口。',
    '',
    '## 隐式实现',
    '',
    '只要方法集合满足要求，类型就实现了接口：',
    '',
    '```go',
    'type Reader interface {',
    '	Read(p []byte) (n int, err error)',
    '}',
    '',
    '// 代码块里的 [[双链]] 和 ![[图片.png]] 应保持原样',
    'type File struct{}',
    '',
    'func (f *File) Read(p []byte) (int, error) { return 0, nil }',
    '```',
    '',
    '行内代码同理：`[[不是链接]]`。',
    '',
    '![接口示意图](../../90%20system/attachments/interface-diagram.png)',
    '',
    '## 接口值',
    '',
    '接口值由**动态类型**和**动态值**两部分组成。',
    '',
    '> [!warning] nil 接口的陷阱',
    '> 持有 nil 指针的接口值本身**不等于** nil。',
    '>',
    '> ```go',
    '> var f *File',
    '> var r Reader = f',
    '> fmt.Println(r == nil) // false',
    '> ```',
    '',
    '### 类型断言',
    '',
    '用 `v, ok := r.(*File)` 取回具体类型。回到[[#隐式实现]]。',
    '',
    '## 小结',
    '',
    '> [!tip]- 展开看一句话总结',
    '> 接口越小越好。',
  ),
  '40 blog/drafts/未完成的草稿.md': lines(
    '---',
    'title: 未完成的草稿',
    'status: draft',
    '---',
    '',
    '草稿不要求 slug 和 date，也不会被导出。它引用的图片同样不能被导出：',
    '',
    '![[private-screenshot.png]]',
    '',
    '草稿里的失效链接不应阻止发布：[[还没写的文章]]',
  ),
  '40 blog/写作/博客搭建记录.md': lines(
    '---',
    'title: 博客搭建记录',
    'slug: building-this-blog',
    'status: published',
    'date: 2026-09-20',
    'tags:',
    '  - 写作',
    '  - go',
    '---',
    '',
    '没有 description 的文章，标签 `go` 与 `Go` 应归为同一个标签。',
    '',
    '## 流程',
    '',
    '1. 在 Obsidian 写作',
    '2. 执行发布命令',
    '3. Vercel 自动部署',
    '',
    '外部链接保持不变：[Astro](https://astro.build)，外部图片也是：',
    '',
    '![外部图片](https://astro.build/assets/press/astro-logo-dark.svg)',
  ),
  '40 blog/旧文.md': lines(
    '---',
    'title: 一篇已撤回的旧文',
    'slug: old-post',
    'status: withdrawn',
    'date: 2026-08-01',
    '---',
    '',
    '撤回后，公开副本和页面都应被移除。',
  ),
  '90 system/attachments/interface-diagram.png': '(image)',
  '90 system/attachments/private-screenshot.png': '(image)',
  '90 system/attachments/发布 流程.webp': '(image)',
}

/** 在临时目录里生成一份基础库，可追加或覆盖文件（路径相对库根目录）。 */
function vault(files: Record<string, string> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-export-'))
  const root = path.join(dir, 'vault')
  for (const [file, content] of Object.entries({ ...BASE, ...files })) {
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
  // 基础库中原有的引用同样会变得有歧义
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
