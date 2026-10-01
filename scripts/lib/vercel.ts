// 核实 Vercel 部署：按提交哈希查找由 GitHub 推送触发的部署，轮询到终态。
// 依赖本机已登录的 `vercel` CLI 和已关联的项目（.vercel/）；不满足时返回 unavailable，不算失败。

import { spawnSync } from 'node:child_process'

export interface Deployment {
  url: string
  /** QUEUED / INITIALIZING / BUILDING / READY / ERROR / CANCELED */
  state: string
  target: string | null
}

export type DeployResult =
  | { status: 'ready'; deployment: Deployment }
  | { status: 'failed'; deployment: Deployment }
  | { status: 'timeout'; deployment?: Deployment }
  | { status: 'unavailable'; reason: string }

/** 返回该提交对应的部署列表；无法查询时抛出带原因的错误。 */
export type ListDeployments = (sha: string) => Deployment[]

export interface WaitOptions {
  list?: ListDeployments
  timeoutMs?: number
  intervalMs?: number
  onProgress?: (state: string) => void
}

const FAILED_STATES = new Set(['ERROR', 'CANCELED'])

export async function waitForDeployment(sha: string, options: WaitOptions = {}): Promise<DeployResult> {
  const { list = listWithCli, timeoutMs = 5 * 60_000, intervalMs = 5_000, onProgress } = options
  const deadline = Date.now() + timeoutMs
  let last: Deployment | undefined
  let lastState = ''

  for (;;) {
    let deployments: Deployment[]
    try {
      deployments = list(sha)
    } catch (error) {
      return { status: 'unavailable', reason: (error as Error).message }
    }
    // 推送后 Vercel 需要几秒才会创建部署，列表为空时继续等。
    last = deployments.find((d) => d.target === 'production') ?? deployments[0]
    const state = last?.state ?? '等待 Vercel 创建部署'
    if (state !== lastState) onProgress?.(state)
    lastState = state

    if (last?.state === 'READY') return { status: 'ready', deployment: last }
    if (last && FAILED_STATES.has(last.state)) return { status: 'failed', deployment: last }
    if (Date.now() + intervalMs > deadline) return { status: 'timeout', deployment: last }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

function listWithCli(sha: string): Deployment[] {
  const result = spawnSync('vercel', ['ls', '--meta', `githubCommitSha=${sha}`, '--format', 'json'], {
    encoding: 'utf8',
  })
  if (result.error) throw new Error('找不到 vercel 命令（npm install -g vercel）')
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout).trim().split('\n').pop() ?? ''
    throw new Error(`vercel ls 执行失败，可能未登录或项目未关联（vercel login / vercel link）：${detail}`)
  }
  try {
    const { deployments } = JSON.parse(result.stdout) as {
      deployments: (Deployment & { meta?: { githubCommitSha?: string } })[]
    }
    // --meta 过滤并不可靠（实测未知的哈希也会返回最近的部署），这里按提交哈希再筛一遍，
    // 否则会把上一次部署的 READY 误报成本次上线。
    return deployments
      .filter((d) => d.meta?.githubCommitSha === sha)
      .map(({ url, state, target }) => ({ url: `https://${url}`, state, target }))
  } catch {
    throw new Error('无法解析 vercel ls 的输出')
  }
}
