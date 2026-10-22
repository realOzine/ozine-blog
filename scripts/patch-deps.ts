// 安装依赖后给 beautiful-mermaid 打补丁（package.json 的 postinstall 调用，本地和 Vercel 都会跑）。
// 库默认把同一节点发出或汇入的连线合并成一条主干（mergeEdges），合并时不避开中间的方框：
// Redis 那篇的 Set 一行，intset → hashtable 从 listpack 底下穿过去。这个开关没有暴露成选项，只能改代码。
// 找不到要改的那行就报错退出：库升级后补丁可能失效，宁可装不上也不要悄悄发布坏图。
import { readFileSync, writeFileSync } from 'node:fs'

const file = 'node_modules/beautiful-mermaid/dist/index.js'
const from = 'return elkToPositioned(result, graph, DEFAULTS2.mergeEdges);'
const to = 'return elkToPositioned(result, graph, false);'

const code = readFileSync(file, 'utf8')
if (code.includes(from)) writeFileSync(file, code.replace(from, to))
else if (!code.includes(to)) {
  console.error(`${file} 里找不到要改的代码，beautiful-mermaid 升级了？请重新检查 scripts/patch-deps.ts。`)
  process.exit(1)
}
