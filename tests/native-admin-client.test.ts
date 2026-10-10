import assert from 'node:assert/strict'
import test from 'node:test'
import { nativeAdminEnabled, nativeAdminRequest, NativeAdminError } from '../lib/native-admin-client'

test('native administration sends only session identity to the native alias', async () => {
  let tokens = 0
  await nativeAdminRequest({ baseUrl: 'http://127.0.0.1:18095', path: '/admin/contracts',
    getToken: async () => { tokens++; return 'session-fixture' }, fetcher: async (url, options) => {
      assert.equal(String(url), 'http://127.0.0.1:18095/v1/admin/admin/contracts')
      assert.deepEqual(options?.headers, { Authorization: 'Bearer session-fixture' })
      assert.equal(options?.credentials, 'omit'); assert.equal(options?.cache, 'no-store'); assert.equal(options?.redirect, 'error')
      return new Response('{}')
    } })
  assert.equal(tokens, 1)
})

test('401 refreshes exactly once and never falls back to a privileged credential', async () => {
  const options: unknown[] = []
  let calls = 0
  await assert.rejects(nativeAdminRequest({ baseUrl: 'https://api.example.com', path: '/me',
    getToken: async value => { options.push(value); return 'fixture' },
    fetcher: async () => { calls++; return new Response('private-provider-detail', { status: 401 }) } }),
  (error: unknown) => error instanceof NativeAdminError && error.status === 401 && !error.message.includes('private-provider'))
  assert.equal(calls, 2)
  assert.deepEqual(options, [undefined, { skipCache: true }])
})

test('unknown mode and nonlocal plaintext API fail closed', async () => {
  const previous = process.env.BACKOFFICE_AUTH_MODE
  try {
    delete process.env.BACKOFFICE_AUTH_MODE; assert.equal(nativeAdminEnabled(), false)
    process.env.BACKOFFICE_AUTH_MODE = 'clerk_jwt'; assert.equal(nativeAdminEnabled(), true)
    process.env.BACKOFFICE_AUTH_MODE = 'mistyped'; assert.throws(nativeAdminEnabled, NativeAdminError)
  } finally {
    if (previous === undefined) delete process.env.BACKOFFICE_AUTH_MODE
    else process.env.BACKOFFICE_AUTH_MODE = previous
  }
  await assert.rejects(nativeAdminRequest({ baseUrl: 'http://api.example.com', path: '/me', getToken: async () => 'fixture' }), NativeAdminError)
})

test('path traversal, webhooks and synthetic user APIs cannot receive an administrative JWT', async () => {
  for (const path of ['/admin/../internal/research', '/admin/%2e%2e/internal/research', '//other.example.com',
    '/webhooks/stripe', '/site/research/synthetic/comparisons', '/admin/resource%2fother'])
    await assert.rejects(nativeAdminRequest({ baseUrl: 'https://api.example.com', path, getToken: async () => 'fixture',
      fetcher: async () => { throw Error('must not fetch') } }), NativeAdminError)
})

test('mutation bodies and search parameters survive without service headers', async () => {
  await nativeAdminRequest({ baseUrl: 'https://api.example.com', path: '/analyst/jobs', method: 'POST',
    body: { fixture: 'ACME' }, searchParams: new URLSearchParams({ limit: '1' }), getToken: async () => 'fixture',
    fetcher: async (url, options) => {
      assert.equal(new URL(String(url)).search, '?limit=1')
      assert.deepEqual(options?.headers, { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' })
      assert.equal(options?.body, '{"fixture":"ACME"}')
      return new Response('{}')
    } })
})
