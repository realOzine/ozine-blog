import assert from 'node:assert/strict'
import { test } from 'node:test'
import { waitForDeployment, type Deployment } from './lib/vercel.ts'

const deployment = (state: string, target: string | null = 'production'): Deployment => ({
  url: 'https://example.vercel.app',
  state,
  target,
})

/** 每次查询依次返回给定的结果，最后一个结果会一直重复。 */
function sequence(...steps: Deployment[][]) {
  let call = 0
  return () => steps[Math.min(call++, steps.length - 1)]
}

const fast = { intervalMs: 1, timeoutMs: 200 }

test('部署创建前列表为空，随后构建成功', async () => {
  const states: string[] = []
  const result = await waitForDeployment('sha', {
    ...fast,
    list: sequence([], [deployment('QUEUED')], [deployment('BUILDING')], [deployment('BUILDING')], [deployment('READY')]),
    onProgress: (state) => states.push(state),
  })
  assert.equal(result.status, 'ready')
  assert.deepEqual(states, ['等待 Vercel 创建部署', 'QUEUED', 'BUILDING', 'READY'])
})

test('构建失败或被取消', async () => {
  for (const state of ['ERROR', 'CANCELED']) {
    const result = await waitForDeployment('sha', { ...fast, list: sequence([deployment('BUILDING')], [deployment(state)]) })
    assert.equal(result.status, 'failed')
    assert.equal(result.status === 'failed' && result.deployment.state, state)
  }
})

test('超时：一直没有出现部署，或一直在构建', async () => {
  const none = await waitForDeployment('sha', { intervalMs: 1, timeoutMs: 20, list: () => [] })
  assert.deepEqual(none, { status: 'timeout', deployment: undefined })
  const building = await waitForDeployment('sha', { intervalMs: 1, timeoutMs: 20, list: () => [deployment('BUILDING')] })
  assert.equal(building.status, 'timeout')
})

test('无法查询时返回 unavailable 而不是失败', async () => {
  const result = await waitForDeployment('sha', {
    ...fast,
    list: () => {
      throw new Error('未登录')
    },
  })
  assert.deepEqual(result, { status: 'unavailable', reason: '未登录' })
})

test('同一提交有多个部署时以生产环境为准', async () => {
  const result = await waitForDeployment('sha', {
    ...fast,
    list: () => [deployment('ERROR', 'preview'), deployment('READY', 'production')],
  })
  assert.equal(result.status, 'ready')
})
