/** Development-only native Backoffice against the isolated sibling stack. */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repos = resolve(root, process.env.FINANCE_REPOS_DIR || '..')
// Load Development identity from the same frontend checkout, without writing
// or replacing this backoffice's environment files.
loadEnvConfig(resolve(repos, 'finance-frontoffice'), true)
const inputs = JSON.parse(readFileSync(process.env.FINANCE_PLATFORM_INPUTS ||
  resolve(repos, 'finance-infra/platform-local/.state/dev-input.json'), 'utf8'))
const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''
const secret = process.env.CLERK_SECRET_KEY || ''
const issuer = `https://${Buffer.from(publishable.slice(8), 'base64').toString().replace(/\$$/, '')}`
if (!publishable.startsWith('pk_test_') || !secret.startsWith('sk_test_') ||
  secret !== inputs.CLERK_SECRET_KEY || issuer !== inputs.CLERK_JWT_ISSUER ||
  !inputs.CLERK_JWT_AUTHORIZED_PARTIES.split(',').includes('http://localhost:3101'))
  throw Error('Use matching Clerk Development inputs with the exact localhost:3101 origin')
const port = process.env.FINANCE_BACKEND_PORT || '18095'
if (!/^\d{4,5}$/.test(port) || Number(port) > 65535) throw Error('Invalid local Backend port')
const env = { ...process.env, NODE_ENV: 'development', BACKOFFICE_AUTH_MODE: 'clerk_jwt',
  ADMIN_AUTH_BYPASS: 'false', ADMIN_EMAIL_ALLOWLIST: '', BACKEND_SERVICE_TOKEN: '',
  BACKEND_SHARED_SECRET: '', CF_ACCESS_CLIENT_ID: '', CF_ACCESS_CLIENT_SECRET: '',
  BACKEND_BASE_URL: `http://127.0.0.1:${port}`, FINANCE_BACKEND_URL: '',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishable, CLERK_SECRET_KEY: secret,
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/sign-in', NEXT_PUBLIC_CLERK_SIGN_UP_URL: '/sign-up',
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: '/', NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: '/',
  NEXT_DIST_DIR: '.next-platform' }
const child = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'),
  'dev', '--hostname', 'localhost', '--port', '3101'], { cwd: root, env, stdio: 'inherit' })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', code => process.exit(code || 0))
console.log('Native backoffice: http://localhost:3101. Start the sibling dev:platform stack first. Explicit Backend grants are required.')
