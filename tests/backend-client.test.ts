import assert from 'node:assert/strict'
import test from 'node:test'
import { nativeAdminJson, NativeAdminError } from '../lib/native-admin-client'
import { BackendProxyError, toBackendProxyErrorPayload } from '../lib/backend-client'

test('native JSON transport parses a successful authenticated response', async () => {
  const { payload } = await nativeAdminJson({ baseUrl: 'http://127.0.0.1:18095', path: '/me',
    getToken: async () => 'synthetic-session', fetcher: async () =>
      new Response('{"permissions":["backoffice.access"]}', { headers: { 'Content-Type': 'application/json' } }) })
  assert.deepEqual(payload, { permissions: ['backoffice.access'] })
})

test('proxy errors exclude upstream bodies, credentials and arbitrary exception text', () => {
  for (const error of [new Error('private-credential'), new BackendProxyError('private-code', 'private-credential', 503,
    { upstreamBodyPreview: 'private-credential' }), new NativeAdminError(403)]) {
    const payload = toBackendProxyErrorPayload(error)
    assert.doesNotMatch(JSON.stringify(payload), /private-credential|private-code/)
    assert.equal(payload.statusCode, error instanceof NativeAdminError ? 403 : 502)
  }
})
