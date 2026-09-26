import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  loadPrefectOverview,
  normalizePrefectOverview,
  PREFECT_OVERVIEW_PATH,
} from '../lib/prefect-overview'
import {
  deploymentLastRunLabel,
  deploymentLastStateLabel,
  deploymentNextRunLabel,
  scheduledRunStateLabel,
} from '../lib/prefect-labels'

test('prefect overview client loads normal response with backend links', async () => {
  const originalBaseUrl = process.env.BACKEND_BASE_URL
  const originalToken = process.env.BACKEND_SERVICE_TOKEN
  const originalFetch = globalThis.fetch

  process.env.BACKEND_BASE_URL = 'http://backend.local'
  process.env.BACKEND_SERVICE_TOKEN = 'service-token'
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), `http://backend.local${PREFECT_OVERVIEW_PATH}`)
    assert.equal(init?.method, 'GET')
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer service-token')
    return new Response(JSON.stringify({
      uiUrl: 'https://prefect.vesconte.com',
      errors: [],
      workPools: [{ name: 'finance-feature-store', status: 'READY', isPaused: false }],
      deploymentCount: 11,
      scheduledCount: 21,
      deployments: [{
        displayName: 'Feature build daily',
        name: 'feature-build-daily/feature-build-daily',
        workPoolName: 'finance-feature-store',
        nextRunAt: '2026-07-14T01:00:00Z',
        lastRunState: 'Completed',
        lastRunAt: '2026-07-13T01:00:00Z',
        url: 'https://prefect.vesconte.com/deployments/deployment-id-from-backend',
      }],
      scheduledRuns: [{
        name: 'scheduled run',
        deploymentName: 'feature-build-daily/feature-build-daily',
        expectedStartTime: '2026-07-14T01:00:00Z',
        stateName: 'Scheduled',
        url: 'https://prefect.vesconte.com/flow-runs/run-id-from-backend',
      }],
      recentRuns: [{
        name: 'recent run',
        deploymentName: 'feature-build-daily/feature-build-daily',
        stateName: 'Completed',
        startTime: '2026-07-13T01:00:00Z',
        endTime: '2026-07-13T01:05:00Z',
        url: 'https://prefect.vesconte.com/flow-runs/recent-run-id-from-backend',
      }],
      recentFailures: [],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const overview = await loadPrefectOverview()
    assert.equal(overview.uiUrl, 'https://prefect.vesconte.com')
    assert.equal(overview.workPools[0].name, 'finance-feature-store')
    assert.equal(overview.deploymentCount, 11)
    assert.equal(overview.scheduledCount, 21)
    assert.equal(overview.deployments[0].url, 'https://prefect.vesconte.com/deployments/deployment-id-from-backend')
    assert.equal(overview.scheduledRuns[0].url, 'https://prefect.vesconte.com/flow-runs/run-id-from-backend')
  } finally {
    process.env.BACKEND_BASE_URL = originalBaseUrl
    process.env.BACKEND_SERVICE_TOKEN = originalToken
    globalThis.fetch = originalFetch
  }
})

test('prefect overview preserves non-blocking backend errors', () => {
  const overview = normalizePrefectOverview({
    uiUrl: 'https://prefect.vesconte.com',
    errors: ['work pool status partially unavailable'],
    workPools: ['finance-ops-self-host'],
    deployments: [],
    scheduledRuns: [],
    recentRuns: [],
    recentFailures: [{ message: 'failed run', url: 'https://prefect.vesconte.com/flow-runs/failure-id' }],
  })

  assert.deepEqual(overview.errors, ['work pool status partially unavailable'])
  assert.equal(overview.workPools[0].name, 'finance-ops-self-host')
  assert.equal(overview.recentFailures[0].url, 'https://prefect.vesconte.com/flow-runs/failure-id')
})

test('prefect overview client rejects unavailable endpoint', async () => {
  const originalBaseUrl = process.env.BACKEND_BASE_URL
  const originalToken = process.env.BACKEND_SERVICE_TOKEN
  const originalFetch = globalThis.fetch

  process.env.BACKEND_BASE_URL = 'http://backend.local'
  process.env.BACKEND_SERVICE_TOKEN = 'service-token'
  globalThis.fetch = async () => {
    throw new Error('connection refused')
  }

  try {
    await assert.rejects(() => loadPrefectOverview(), /Failed to reach backend: connection refused/)
  } finally {
    process.env.BACKEND_BASE_URL = originalBaseUrl
    process.env.BACKEND_SERVICE_TOKEN = originalToken
    globalThis.fetch = originalFetch
  }
})

test('prefect overview client rejects non-ok JSON response', async () => {
  const originalBaseUrl = process.env.BACKEND_BASE_URL
  const originalToken = process.env.BACKEND_SERVICE_TOKEN
  const originalFetch = globalThis.fetch

  process.env.BACKEND_BASE_URL = 'http://backend.local'
  process.env.BACKEND_SERVICE_TOKEN = 'service-token'
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'overview disabled' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })

  try {
    await assert.rejects(() => loadPrefectOverview(), /overview disabled/)
  } finally {
    process.env.BACKEND_BASE_URL = originalBaseUrl
    process.env.BACKEND_SERVICE_TOKEN = originalToken
    globalThis.fetch = originalFetch
  }
})

test('operations page does not expose mutable Prefect actions', () => {
  const source = readFileSync('app/operations/ui.tsx', 'utf8').toLowerCase()
  assert.equal(source.includes('<button'), false, 'operations page should not render action buttons')
  for (const forbidden of ['run now', 'retry', 'resume', 'cancel run', 'edit schedule']) {
    assert.equal(source.includes(forbidden), false, `unexpected mutable action label: ${forbidden}`)
  }
})

test('prefect operations labels distinguish empty scheduled and run-history fields', () => {
  assert.equal(scheduledRunStateLabel('', '2026-07-14T01:00:00Z'), 'Scheduled')
  assert.equal(scheduledRunStateLabel('', ''), 'unknown')
  assert.equal(deploymentLastStateLabel(''), 'No runs yet')
  assert.equal(deploymentLastRunLabel(''), 'No runs yet')
  assert.equal(deploymentNextRunLabel(''), 'Not scheduled')
})

test('a deployment with a schedule but nothing queued is not called unscheduled', () => {
  assert.equal(deploymentNextRunLabel('', true), 'Scheduled, none queued')
  assert.equal(deploymentNextRunLabel('', false), 'Not scheduled')
  assert.equal(deploymentNextRunLabel('', undefined), 'Not scheduled')
})
