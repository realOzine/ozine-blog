// 发布命令：校验 → 导出到临时目录 → 构建检查 → 更新 published/ → 提交 → 推送 → 核实部署。
// 推送之前任何一步失败都会停止，并且不会推送。
//
//   npm run release                 完整发布
//   npm run release -- --dry-run    只做校验、导出和构建检查，不改动 published/ 与 Git
//   npm run release -- --no-push    提交但不推送
//   npm run release -- --no-wait    推送后不等待 Vercel 部署结果

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { exportContent, formatIssue } from './lib/export.ts'
import { waitForDeployment } from './lib/vercel.ts'

const { values: args } = parseArgs({
  options: {
    content: { type: 'string', default: 'content' },
    'dry-run': { type: 'boolean', default: false },
    'no-push': { type: 'boolean', default: false },
    'no-wait': { type: 'boolean', default: false },
  },
})

const root = path.resolve(import.meta.dirname, '..')
const publishedDir = path.join(root, 'published')
const tmpDir = path.join(root, '.publish-tmp')

function run(command: string, commandArgs: string[], options: { env?: NodeJS.ProcessEnv; quiet?: boolean } = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
    stdio: options.quiet ? 'pipe' : 'inherit',
  })
  return { ok: result.status === 0, stdout: (result.stdout ?? '').trim(), stderr: (result.stderr ?? '').trim() }
}

const git = (...gitArgs: string[]) => run('git', gitArgs, { quiet: true })

function step(title: string) {
  console.log(`\n▸ ${title}`)
}

function fail(message: string): never {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  console.error(`\n✗ ${message}`)
  process.exit(1)
}

// ---------- 1. 发布前检查 ----------

step('检查 Git 状态')
if (!git('rev-parse', '--is-inside-work-tree').ok) fail('当前目录不是 Git 仓库。')
if (!git('diff', '--cached', '--quiet').ok) {
  fail('暂存区里已有其他变更。发布命令只提交 published/，请先提交或取消暂存这些变更。')
}
const dirty = git('status', '--porcelain', '--', '.', ':!published').stdout
if (dirty) {
  console.log('  注意：published/ 之外还有未提交的变更，它们不会包含在本次发布里：')
  console.log(dirty.split('\n').map((line) => `    ${line}`).join('\n'))
}

// ---------- 2. 校验并导出到临时目录 ----------

step('校验并导出内容')
const result = exportContent({ contentDir: path.resolve(root, args.content), outDir: tmpDir })
if (result.issues.length > 0) {
  console.error(`  发现 ${result.issues.length} 个问题：\n`)
  for (const issue of result.issues) console.error(`  ${formatIssue(issue)}`)
  fail('内容校验未通过，没有改动 published/，也没有提交或推送。')
}
console.log(
  `  ${result.posts.length} 篇文章、${result.assets.length} 个附件` +
    `（跳过草稿 ${result.skipped.draft} 篇、已撤回 ${result.skipped.withdrawn} 篇）`,
)

// ---------- 3. 用临时副本构建网站 ----------

step('构建检查')
if (!run('npx', ['astro', 'build'], { env: { PUBLISHED_DIR: './.publish-tmp' } }).ok) {
  fail('网站构建失败，没有改动 published/，也没有提交或推送。')
}

if (args['dry-run']) {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  console.log('\n✓ 演练通过（--dry-run）：未改动 published/，未提交，未推送。')
  process.exit(0)
}

// ---------- 4. 更新公开副本 ----------

step('更新 published/')
// 整体替换：已撤回、改回草稿或已删除的文章及其附件随之消失。
fs.rmSync(publishedDir, { recursive: true, force: true })
fs.renameSync(tmpDir, publishedDir)

git('add', '--all', '--', 'published')
const changes = git('diff', '--cached', '--name-status', '--', 'published').stdout
if (!changes) {
  console.log('\n✓ 内容没有变化，无需发布。')
  process.exit(0)
}
console.log(changes.split('\n').map((line) => `  ${line}`).join('\n'))

// ---------- 5. 提交 ----------

step('提交')
const count = (status: string) =>
  changes.split('\n').filter((line) => line.startsWith(status) && line.includes('published/posts/')).length
const message = `content: 新增 ${count('A')}、更新 ${count('M')}、移除 ${count('D')} 篇文章`
const commit = git('commit', '-m', message, '--', 'published')
if (!commit.ok) fail(`提交失败：\n${commit.stderr || commit.stdout}`)
console.log(`  ${message}`)

// ---------- 6. 推送 ----------

if (args['no-push']) {
  console.log('\n✓ 已提交，未推送（--no-push）。')
  process.exit(0)
}

step('推送')
const hasUpstream = git('rev-parse', '--abbrev-ref', '@{upstream}').ok
if (!hasUpstream && !git('remote', 'get-url', 'origin').ok) {
  fail('已提交到本地，但仓库还没有配置远程 origin，未推送。')
}
const push = hasUpstream ? git('push') : git('push', '--set-upstream', 'origin', 'HEAD')
if (!push.ok) {
  fail(`已提交到本地，但推送失败（可能是远程有新提交或网络问题），请处理后手动 git push：\n${push.stderr}`)
}

console.log('  推送成功。')

// ---------- 7. 核实部署 ----------
// 「推送成功」与「部署成功」分别报告：只有 Vercel 确认构建完成，才算上线。

if (args['no-wait']) {
  console.log('\n✓ 推送成功。部署状态未核实（--no-wait）。')
  process.exit(0)
}

step('等待 Vercel 部署')
const sha = git('rev-parse', 'HEAD').stdout
const deploy = await waitForDeployment(sha, { onProgress: (state) => console.log(`  ${state}`) })

switch (deploy.status) {
  case 'ready':
    console.log(`\n✓ 上线完成：${deploy.deployment.url}`)
    break
  case 'failed':
    console.error(`\n✗ 推送成功，但 Vercel 部署失败（${deploy.deployment.state}）：${deploy.deployment.url}`)
    console.error(`  线上仍是上一个版本。查看日志：vercel inspect ${deploy.deployment.url} --logs`)
    process.exit(1)
  case 'timeout':
    console.log(`\n! 推送成功，但等待部署超时，部署状态未核实。${deploy.deployment ? `当前状态：${deploy.deployment.state}` : ''}`)
    break
  case 'unavailable':
    console.log(`\n! 推送成功，但无法核实部署状态：${deploy.reason}`)
    break
}
