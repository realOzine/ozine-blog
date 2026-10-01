// 只导出、不构建、不提交：npm run export [-- --content <目录>] [--out <目录>]
import { parseArgs } from 'node:util'
import { exportContent, formatIssue } from './lib/export.ts'

const { values } = parseArgs({
  options: {
    content: { type: 'string', default: 'content' },
    out: { type: 'string', default: 'published' },
  },
})

const result = exportContent({ contentDir: values.content, outDir: values.out })
if (result.issues.length > 0) {
  console.error(`发现 ${result.issues.length} 个问题，未写入任何文件：\n`)
  for (const issue of result.issues) console.error(`  ${formatIssue(issue)}`)
  process.exit(1)
}
console.log(
  `已导出 ${result.posts.length} 篇文章、${result.assets.length} 个附件到 ${values.out}/` +
    `（跳过草稿 ${result.skipped.draft} 篇、已撤回 ${result.skipped.withdrawn} 篇）`,
)
