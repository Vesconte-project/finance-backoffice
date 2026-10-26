import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as React from 'react'
import * as JSX from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

function load(file, imports) {
  const exports = {}
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText
  runInNewContext(code, { exports, process: { env: {} }, Response,
    require(name) { assert.ok(Object.hasOwn(imports, name), `Unexpected import ${name}`); return imports[name] },
  }, { filename: file })
  return exports
}
const native = load('lib/native-admin-client.ts', { './http-json': {} })
const { NativeAdminError } = native

for (const scenario of ['admin', 'denied', 'signed-out', 'unavailable']) test(`admin shell: ${scenario}`, async () => {
  let imports = 0, panelRenders = 0, checks = 0
  const { resolveAdminAccess } = load('lib/admin-access.ts', {
    './admin-auth': { requireAdminUser: async () => {
      checks++
      if (scenario === 'admin') return { userId: randomUUID() }
      throw new NativeAdminError(scenario === 'denied' ? 403 : scenario === 'signed-out' ? 401 : 503)
    } }, './native-admin-client': native,
  })
  const clerk = {
    SignInButton: ({ children }) => React.createElement('div', { 'data-sign-in': '' }, children),
    SignOutButton: ({ children }) => React.createElement('div', { 'data-sign-out': '' }, children),
    UserButton: () => React.createElement('button', null, 'Account'),
  }
  const modules = {
    'react/jsx-runtime': JSX, '@clerk/nextjs': clerk, '@/lib/admin-access': { resolveAdminAccess },
    '@/lib/sidebar-state': { grayHealth: () => ({}) },
  }
  Object.defineProperty(modules, '@/components/layout/Sidebar', { get() {
    imports++
    assert.equal(scenario, 'admin', 'denial must not import panel navigation')
    return { Sidebar: () => React.createElement('nav', null, 'Administrative navigation') }
  } })
  const { default: Layout } = load('app/(admin)/layout.tsx', modules)
  function PrivatePanel() { panelRenders++; assert.equal(scenario, 'admin'); return React.createElement('section', null, 'Private panel') }
  const html = renderToStaticMarkup(await Layout({ children: React.createElement(PrivatePanel) }))
  assert.equal(checks, 1)
  assert.equal(imports, scenario === 'admin' ? 1 : 0)
  assert.equal(panelRenders, scenario === 'admin' ? 1 : 0)
  if (scenario === 'admin') assert.match(html, /Administrative navigation.*Private panel/)
  else {
    assert.doesNotMatch(html, /Administrative navigation|Private panel|app-shell/)
    assert.match(html, scenario === 'signed-out' ? /Sign in/ : /Sign out/)
    assert.match(html, scenario === 'unavailable' ? /temporarily unavailable/ : /Administrative access required/)
  }
})

test('server verifier distinguishes missing permission, malformed data, and no session', async () => {
  for (const scenario of ['admin', 'denied', 'malformed', 'signed-out']) {
    let backendCalls = 0
    const { requireAdminUser } = load('lib/admin-auth.ts', {
      react: { cache: fn => fn },
      '@clerk/nextjs/server': { auth: async () => ({ userId: scenario === 'signed-out' ? null : 'fixture-user', getToken: async () => 'fixture-token' }) },
      './native-admin-client': { ...native, nativeAdminRequest: async () => {
        backendCalls++
        return Response.json(scenario === 'malformed' ? {} : { user_id: randomUUID(), permissions: scenario === 'admin' ? ['backoffice.access'] : [] })
      } },
    })
    if (scenario === 'admin') assert.ok((await requireAdminUser()).userId)
    else await assert.rejects(requireAdminUser(), error => error instanceof NativeAdminError && error.status === (scenario === 'denied' ? 403 : scenario === 'signed-out' ? 401 : 503))
    assert.equal(backendCalls, scenario === 'signed-out' ? 0 : 1)
  }
})
