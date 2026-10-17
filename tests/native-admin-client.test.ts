import assert from 'node:assert/strict'
import test from 'node:test'
import { nativeAdminRequest, nativeAdminJson, NativeAdminError } from '../lib/native-admin-client'

test('native administration sends only session identity to the native alias', async () => {
  let tokens = 0
  await nativeAdminRequest({ baseUrl: 'http://127.0.0.1:18095', path: '/contracts',
    getToken: async () => { tokens++; return 'session-fixture' }, fetcher: async (url, options) => {
      assert.equal(String(url), 'http://127.0.0.1:18095/v1/admin/contracts')
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

test('nonlocal plaintext API fails closed', async () => {
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

test('missing session never makes a backend request even with legacy environment present', async () => {
  const previous = process.env.BACKEND_SERVICE_TOKEN
  process.env.BACKEND_SERVICE_TOKEN = 'synthetic-unused-service-token'
  let requests = 0
  try {
    await assert.rejects(nativeAdminRequest({ baseUrl: 'https://api.example.com', path: '/me',
      getToken: async () => null, fetcher: async () => { requests++; return new Response('{}') } }),
      (error: unknown) => error instanceof NativeAdminError && error.status === 401)
    assert.equal(requests, 0)
  } finally {
    if (previous === undefined) delete process.env.BACKEND_SERVICE_TOKEN
    else process.env.BACKEND_SERVICE_TOKEN = previous
  }
})

test('backend refusals and malformed JSON never expose an upstream body', async () => {
  for (const status of [200, 401, 403, 429, 503]) {
    await assert.rejects(nativeAdminJson({ baseUrl: 'https://api.example.com', path: '/me',
      getToken: async () => 'synthetic-session', fetcher: async () =>
        new Response('private-credential-never-echo', { status, headers: { 'Content-Type': 'application/json' } }) }),
      (error: unknown) => error instanceof NativeAdminError && !error.message.includes('private-credential'))
  }
})

test('rate refusals retain a bounded Retry-After without response details', async () => {
  await assert.rejects(nativeAdminRequest({ baseUrl: 'https://api.example.com', path: '/me',
    getToken: async () => 'synthetic-session', fetcher: async () => new Response('private', {
      status: 429, headers: { 'Retry-After': '60' } }) }),
    (error: unknown) => error instanceof NativeAdminError && error.status === 429 && error.retryAfter === '60')
})
