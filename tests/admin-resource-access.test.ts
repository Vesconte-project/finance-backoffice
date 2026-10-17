import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import test from 'node:test'
import { readResourceAccessBody, ResourceAccessInputError } from '../lib/admin-resource-access'

const request = (body: string, headers: Record<string, string> = {}) =>
  new Request('https://backoffice.fixture.invalid/api/admin/resource-access', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body })

test('bounded single-resource input preserves the explicit selector and reason', async () => {
  const body = { resource_type: 'research_experiment', resource_id: 'synthetic-one', reason: 'Synthetic support case' }
  assert.deepEqual(await readResourceAccessBody(request(JSON.stringify(body))), body)
})

test('malformed JSON and oversized bodies fail without echoing input', async () => {
  for (const [body, status] of [['private-body', 400], ['x'.repeat(8193), 413]] as const) {
    await assert.rejects(readResourceAccessBody(request(body)), (error: unknown) =>
      error instanceof ResourceAccessInputError && error.status === status && !error.message.includes('private-body'))
  }
  await assert.rejects(readResourceAccessBody(request('{}', { 'Content-Length': '8193' })), ResourceAccessInputError)
})

test('chunked input is stopped and cancelled at the byte boundary', async () => {
  let reads = 0, cancelled = false
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { reads++; controller.enqueue(new Uint8Array(4096)) },
    cancel() { cancelled = true },
  }, { highWaterMark: 0 })
  const streamed = new Request('https://backoffice.fixture.invalid/api/admin/resource-access', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body, duplex: 'half',
  } as RequestInit)
  await assert.rejects(readResourceAccessBody(streamed), (error: unknown) =>
    error instanceof ResourceAccessInputError && error.status === 413)
  assert.equal(reads, 3)
  assert.equal(cancelled, true)
})

test('private list proxies and credential transports are actually removed', () => {
  for (const path of ['app/api/research/experiments/route.ts', 'app/api/registry/candidates/route.ts',
    'app/api/registry/readiness-reports/route.ts', 'app/api/signal-evaluation/candidates/route.ts',
    'app/api/analyst/jobs/route.ts']) assert.equal(existsSync(path), false, path)
  const source = ['lib/admin-auth.ts', 'lib/backend-client.ts', 'lib/native-admin-client.ts', 'proxy.ts']
    .map(path => readFileSync(path, 'utf8')).join('\n')
  assert.doesNotMatch(source, /ADMIN_EMAIL_ALLOWLIST|ADMIN_AUTH_BYPASS|BACKOFFICE_AUTH_MODE|BACKEND_SERVICE_TOKEN|BACKEND_SHARED_SECRET|currentUser/)
})
