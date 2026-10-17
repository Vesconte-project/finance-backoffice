import {
  backendBaseUrlConfigured,
  requestBackendJson,
} from '@/lib/backend-client'

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
  adminActor: string
  backendApi: {
    status: HealthState
    configured: boolean
    baseUrlConfigured: boolean
    message: string
  }
  registryApi: {
    status: HealthState
    configured: boolean
    message: string
  }
  routeChecks: RouteProbe[]
}

export async function loadBackofficeHealth(adminActor: string): Promise<BackofficeHealthSnapshot> {
  const checkedAt = new Date().toISOString()
  const backendConfigured = backendBaseUrlConfigured()

  const routeChecks = await Promise.all([
    probeBackendRoute({
      label: 'Backend administrative identity',
      path: '/me',

    }),
    probeBackendRoute({
      label: 'Data quality health',
      path: '/analyst/data-ops/health',
      searchParams: new URLSearchParams({ domains: 'market', end_date: checkedAt.slice(0, 10) }),

    }),
    probeRegistryRoute(),
  ])

  const backendHealthProbe = routeChecks[0]
  const registryProbe = routeChecks[2]

  return {
    checkedAt,
    adminActor,
    backendApi: {
      status: backendConfigured ? backendHealthProbe.status : 'missing',
      configured: backendConfigured,
      baseUrlConfigured: backendConfigured,
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

}: {
  label: string
  path: string
  searchParams?: URLSearchParams

}): Promise<RouteProbe> {
  if (!backendBaseUrlConfigured()) {
    return missingProbe(label, path, 'Backend base URL is missing.')
  }

  try {
    const { upstream } = await requestBackendJson({
      path,
      method: 'GET',
      searchParams,

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
    return missingProbe('Registry proxy', '/analyst/registry/active-pointers', 'Backend base URL is missing.')
  }

  try {
    const { payload, upstream } = await requestBackendJson({
      path: '/analyst/registry/active-pointers',
      method: 'GET',
      searchParams: new URLSearchParams({ environment: 'production' }),

    })
    if (!payload || typeof payload !== 'object') {
      return {
        label: 'Registry proxy',
        method: 'GET',
        path: '/analyst/registry/active-pointers',
        status: 'missing',
        httpStatus: upstream.status,
        message: 'Registry evidence is not available through finance-backend yet.',
      }
    }

    return {
      label: 'Registry proxy',
      method: 'GET',
      path: '/analyst/registry/active-pointers',
      status: upstream.ok ? 'reachable' : 'unreachable',
      httpStatus: upstream.status,
      message: upstream.ok ? 'Reachable.' : `Responded with HTTP ${upstream.status}.`,
    }
  } catch (error) {
    return {
      label: 'Registry proxy',
      method: 'GET',
      path: '/analyst/registry/active-pointers',
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
