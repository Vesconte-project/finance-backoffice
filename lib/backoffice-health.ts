import {
  backendBaseUrlConfigured,
  backendServiceTokenConfigured,
  requestBackendJson,
} from '@/lib/backend-client'
import { isRegistryUnavailablePayload } from '@/lib/registry-backend'
import { nativeAdminEnabled } from '@/lib/native-admin-client'

export type HealthState = 'reachable' | 'unreachable' | 'missing' | 'configured'

export type RouteProbe = {
  label: string
  method: 'GET'
  path: string
  status: HealthState
  httpStatus?: number
  message: string
}

export type BackofficeHealthSnapshot = {
  checkedAt: string
  adminEmail: string
  backendApi: {
    status: HealthState
    configured: boolean
    baseUrlConfigured: boolean
    serviceTokenConfigured: boolean
    message: string
  }
  registryApi: {
    status: HealthState
    configured: boolean
    message: string
  }
  routeChecks: RouteProbe[]
}

export async function loadBackofficeHealth(adminEmail: string): Promise<BackofficeHealthSnapshot> {
  const checkedAt = new Date().toISOString()
  const backendConfigured = backendBaseUrlConfigured()
  const serviceTokenConfigured = backendServiceTokenConfigured()

  const routeChecks = await Promise.all([
    probeBackendRoute({
      label: nativeAdminEnabled() ? 'Backend administrative identity' : 'Backend /health',
      path: nativeAdminEnabled() ? '/me' : '/health',
      includeCloudflareAccess: true,
      requireBackendServiceToken: false,
    }),
    probeBackendRoute({
      label: 'Research experiment list',
      path: '/analyst/research/experiments',
      searchParams: new URLSearchParams({ limit: '1' }),
      includeCloudflareAccess: true,
      requireBackendServiceToken: true,
    }),
    probeBackendRoute({
      label: 'Data quality health',
      path: '/analyst/data-ops/health',
      searchParams: new URLSearchParams({ domains: 'market', end_date: checkedAt.slice(0, 10) }),
      includeCloudflareAccess: true,
      requireBackendServiceToken: true,
    }),
    probeRegistryRoute(),
  ])

  const backendHealthProbe = routeChecks[0]
  const registryProbe = routeChecks[3]

  return {
    checkedAt,
    adminEmail,
    backendApi: {
      status: backendConfigured ? backendHealthProbe.status : 'missing',
      configured: backendConfigured,
      baseUrlConfigured: backendConfigured,
      serviceTokenConfigured,
      message: backendConfigured
        ? backendHealthProbe.message
        : 'BACKEND_BASE_URL or FINANCE_BACKEND_URL is not configured.',
    },
    registryApi: {
      status: registryProbe.status,
      configured: registryProbe.status === 'reachable',
      message: registryProbe.message,
    },
    routeChecks,
  }
}

async function probeBackendRoute({
  label,
  path,
  searchParams,
  requireBackendServiceToken,
  includeCloudflareAccess,
}: {
  label: string
  path: string
  searchParams?: URLSearchParams
  requireBackendServiceToken: boolean
  includeCloudflareAccess: boolean
}): Promise<RouteProbe> {
  if (!backendBaseUrlConfigured()) {
    return missingProbe(label, path, 'Backend base URL is missing.')
  }

  try {
    const { upstream } = await requestBackendJson({
      path,
      method: 'GET',
      searchParams,
      requireBackendServiceToken,
      includeCloudflareAccess,
    })
    return {
      label,
      method: 'GET',
      path,
      status: upstream.ok ? 'reachable' : 'unreachable',
      httpStatus: upstream.status,
      message: upstream.ok ? 'Reachable.' : `Responded with HTTP ${upstream.status}.`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Route probe failed.'
    return {
      label,
      method: 'GET',
      path,
      status: 'unreachable',
      message,
    }
  }
}

async function probeRegistryRoute(): Promise<RouteProbe> {
  if (!backendBaseUrlConfigured()) {
    return missingProbe('Registry proxy', '/analyst/registry/promotion-events', 'Backend base URL is missing.')
  }

  try {
    const { payload, upstream } = await requestBackendJson({
      path: '/analyst/registry/promotion-events',
      method: 'GET',
      searchParams: new URLSearchParams({ limit: '1' }),
      requireBackendServiceToken: true,
      includeCloudflareAccess: true,
    })
    if (isRegistryUnavailablePayload(payload)) {
      return {
        label: 'Registry proxy',
        method: 'GET',
        path: '/analyst/registry/promotion-events',
        status: 'missing',
        httpStatus: upstream.status,
        message: 'Registry evidence is not available through finance-backend yet.',
      }
    }

    return {
      label: 'Registry proxy',
      method: 'GET',
      path: '/analyst/registry/promotion-events',
      status: upstream.ok ? 'reachable' : 'unreachable',
      httpStatus: upstream.status,
      message: upstream.ok ? 'Reachable.' : `Responded with HTTP ${upstream.status}.`,
    }
  } catch (error) {
    return {
      label: 'Registry proxy',
      method: 'GET',
      path: '/analyst/registry/promotion-events',
      status: 'unreachable',
      message: error instanceof Error ? error.message : 'Registry probe failed.',
    }
  }
}

function missingProbe(label: string, path: string, message: string): RouteProbe {
  return {
    label,
    method: 'GET',
    path,
    status: 'missing',
    message,
  }
}
