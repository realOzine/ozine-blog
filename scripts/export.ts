// 只导出、不构建、不提交：npm run export [-- --content <目录>] [--out <目录>]
import { parseArgs } from 'node:util'
import { exportContent, formatIssues, formatSummary } from './lib/export.ts'

const { values } = parseArgs({
  options: {
    content: { type: 'string', default: 'content' },
    out: { type: 'string', default: 'published' },
  },
})

const result = await exportContent({ contentDir: values.content, outDir: values.out })
if (result.issues.length > 0) {
  console.error(formatIssues(result.issues))
  console.error('\n未写入任何文件。')
  process.exit(1)
}
console.log(`已导出到 ${values.out}/：${formatSummary(result)}`)
