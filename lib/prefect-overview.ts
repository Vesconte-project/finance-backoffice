import { BackendProxyError, requestBackendJson } from './backend-client'
import { asRecord } from './payload'

export const PREFECT_OVERVIEW_PATH = '/admin/ops/prefect/overview'
export const PREFECT_FALLBACK_UI_URL = 'https://prefect.vesconte.com'

export type PrefectWorkPool = {
  name: string
  status: string
  isPaused: boolean | null
}

export type PrefectDeployment = {
  name: string
  displayName: string
  workPoolName: string
  nextRunAt: string
  lastRunState: string
  lastRunAt: string
  hasSchedule: boolean
  url: string
}

export type PrefectScheduledRun = {
  name: string
  deploymentName: string
  expectedStartTime: string
  stateName: string
  url: string
}

export type PrefectRecentRun = {
  name: string
  deploymentName: string
  stateName: string
  startTime: string
  endTime: string
  url: string
}

export type PrefectRecentFailure = {
  message: string
  url: string
}

export type PrefectOverview = {
  uiUrl: string
  errors: string[]
  workPools: PrefectWorkPool[]
  deploymentCount: number
  scheduledCount: number
  deployments: PrefectDeployment[]
  scheduledRuns: PrefectScheduledRun[]
  recentRuns: PrefectRecentRun[]
  recentFailures: PrefectRecentFailure[]
}

export async function loadPrefectOverview(): Promise<PrefectOverview> {
  const { payload, upstream } = await requestBackendJson({
    path: PREFECT_OVERVIEW_PATH,
    requireBackendServiceToken: true,
    includeCloudflareAccess: true,
  })
  if (!upstream.ok) {
    throw new BackendProxyError(
      'PREFECT_OVERVIEW_UNAVAILABLE',
      readBackendErrorMessage(payload) || `Prefect overview endpoint returned HTTP ${upstream.status}.`,
      502,
      { upstreamStatus: upstream.status }
    )
  }
  return normalizePrefectOverview(payload)
}

export function normalizePrefectOverview(payload: unknown): PrefectOverview {
  const record = asRecord(payload) ?? {}
  const deployments = readList(record.deployments).map(normalizeDeployment).filter((deployment) => deployment.name || deployment.displayName)
  const scheduledRuns = readList(record.scheduledRuns ?? record.upcomingScheduledRuns).map(normalizeScheduledRun).filter((run) => run.name || run.deploymentName)
  const recentRuns = readList(record.recentRuns).map(normalizeRecentRun).filter((run) => run.name || run.deploymentName)
  const recentFailures = readList(record.recentFailures).map(normalizeRecentFailure).filter((failure) => failure.message || failure.url)

  return {
    uiUrl: readString(record, ['uiUrl', 'ui_url']) || PREFECT_FALLBACK_UI_URL,
    errors: readErrors(record.errors),
    workPools: readList(record.workPools ?? record.work_pools).map(normalizeWorkPool).filter((pool) => pool.name),
    deploymentCount: readNumber(record, ['deploymentCount', 'deployment_count']) ?? deployments.length,
    scheduledCount: readNumber(record, ['scheduledCount', 'scheduled_count']) ?? scheduledRuns.length,
    deployments,
    scheduledRuns,
    recentRuns,
    recentFailures,
  }
}

function normalizeWorkPool(value: unknown): PrefectWorkPool {
  if (typeof value === 'string') {
    return { name: value, status: '', isPaused: null }
  }
  const record = asRecord(value) ?? {}
  return {
    name: readString(record, ['name', 'workPoolName', 'work_pool_name']),
    status: readString(record, ['status']),
    isPaused: readBoolean(record, ['isPaused', 'is_paused']),
  }
}

function normalizeDeployment(value: unknown): PrefectDeployment {
  const record = asRecord(value) ?? {}
  const name = readString(record, ['name', 'deploymentName', 'deployment_name'])
  return {
    name,
    displayName: readString(record, ['displayName', 'display_name']) || name,
    workPoolName: readString(record, ['workPoolName', 'work_pool_name']),
    nextRunAt: readString(record, ['nextRunAt', 'next_run_at']),
    lastRunState: readString(record, ['lastRunState', 'last_run_state']),
    lastRunAt: readString(record, ['lastRunAt', 'last_run_at']),
    hasSchedule: record.hasSchedule === true || record.has_schedule === true,
    url: readString(record, ['url']),
  }
}

function normalizeScheduledRun(value: unknown): PrefectScheduledRun {
  const record = asRecord(value) ?? {}
  return {
    name: readString(record, ['name', 'flowRunName', 'flow_run_name']),
    deploymentName: readString(record, ['deploymentName', 'deployment_name']),
    expectedStartTime: readString(record, ['expectedStartTime', 'expected_start_time']),
    stateName: readString(record, ['stateName', 'state_name']),
    url: readString(record, ['url']),
  }
}

function normalizeRecentRun(value: unknown): PrefectRecentRun {
  const record = asRecord(value) ?? {}
  return {
    name: readString(record, ['name', 'flowRunName', 'flow_run_name']),
    deploymentName: readString(record, ['deploymentName', 'deployment_name']),
    stateName: readString(record, ['stateName', 'state_name']),
    startTime: readString(record, ['startTime', 'start_time', 'expectedStartTime', 'expected_start_time']),
    endTime: readString(record, ['endTime', 'end_time']),
    url: readString(record, ['url']),
  }
}

function normalizeRecentFailure(value: unknown): PrefectRecentFailure {
  if (typeof value === 'string') {
    return { message: value, url: '' }
  }
  const record = asRecord(value) ?? {}
  return {
    message: readString(record, ['message', 'error', 'stateMessage', 'state_message', 'name']),
    url: readString(record, ['url']),
  }
}

function readList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readErrors(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return item
      const record = asRecord(item)
      return record ? readString(record, ['message', 'error', 'detail']) : ''
    })
    .filter(Boolean)
}

function readString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  }
  return ''
}

function readNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return undefined
}

function readBoolean(record: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
  }
  return null
}

function readBackendErrorMessage(payload: unknown): string {
  const record = asRecord(payload)
  return record ? readString(record, ['message', 'error', 'detail']) : ''
}
