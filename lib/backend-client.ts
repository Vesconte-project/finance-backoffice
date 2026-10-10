import { NextResponse } from 'next/server'
import { mapAuthErrorStatus, requireAdminUser } from './admin-auth'
import { JsonResponseParseError, readJsonResponse } from './http-json'
import { nativeAdminEnabled, nativeAdminRequest } from './native-admin-client'

type ProxyBackendJsonOptions = {
  path: string
  method?: 'GET' | 'POST'
  searchParams?: URLSearchParams
  body?: unknown
  requireBackendServiceToken?: boolean
  includeCloudflareAccess?: boolean
}

export type BackendProxyErrorPayload = {
  error: string
  message: string
  statusCode: number
  upstreamStatus?: number
  upstreamContentType?: string
  upstreamBodyPreview?: string
  details?: Record<string, unknown>
}

export class BackendProxyError extends Error {
  code: string
  statusCode: number
  details: Record<string, unknown>

  constructor(code: string, message: string, statusCode: number, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'BackendProxyError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

export function backendServiceToken(required = false): string {
  const token = (
    process.env.BACKEND_SERVICE_TOKEN
    || process.env.FINANCE_BACKEND_SERVICE_TOKEN
    || ''
  ).trim()
  if (!token && required) {
    throw new Error('BACKEND_SERVICE_TOKEN_MISSING')
  }
  return token
}

export function backendServiceTokenConfigured(): boolean {
  return Boolean(backendServiceToken(false))
}

export function backendSharedSecret(): string {
  return (process.env.BACKEND_SHARED_SECRET || '').trim()
}

export function cloudflareAccessHeaders(): HeadersInit {
  const clientId = (process.env.CF_ACCESS_CLIENT_ID || '').trim()
  const clientSecret = (process.env.CF_ACCESS_CLIENT_SECRET || '').trim()

  if (!clientId && !clientSecret) {
    return {}
  }
  if (!clientId || !clientSecret) {
    throw new Error('CF_ACCESS_SERVICE_TOKEN_INCOMPLETE')
  }

  return {
    'CF-Access-Client-Id': clientId,
    'CF-Access-Client-Secret': clientSecret,
  }
}

export function backendBaseUrl(): string {
  const base = (process.env.BACKEND_BASE_URL || process.env.FINANCE_BACKEND_URL || '').trim()
  if (!base) {
    throw new Error('BACKEND_BASE_URL_MISSING')
  }
  return base.replace(/\/$/, '')
}

export function backendBaseUrlConfigured(): boolean {
  return Boolean((process.env.BACKEND_BASE_URL || process.env.FINANCE_BACKEND_URL || '').trim())
}

export function backendHeaders({
  includeJsonContentType = true,
  requireBackendServiceToken = false,
  includeCloudflareAccess = true,
}: {
  includeJsonContentType?: boolean
  requireBackendServiceToken?: boolean
  includeCloudflareAccess?: boolean
} = {}): HeadersInit {
  const headers: HeadersInit = {}
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json'
  }

  const token = backendServiceToken(requireBackendServiceToken)
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  // Signal/ticker/site backend routes are gated by the shared secret (not the
  // bearer service token). Send both; each backend route validates its own.
  const sharedSecret = backendSharedSecret()
  if (sharedSecret) {
    headers['x-backend-shared-secret'] = sharedSecret
  }

  if (includeCloudflareAccess) {
    Object.assign(headers, cloudflareAccessHeaders())
  }

  return headers
}

export async function requestBackendJson({
  path,
  method = 'GET',
  searchParams,
  body,
  requireBackendServiceToken = false,
  includeCloudflareAccess = true,
}: ProxyBackendJsonOptions): Promise<{ payload: unknown; upstream: Response }> {
  if (nativeAdminEnabled()) {
    const { auth } = await import('@clerk/nextjs/server')
    const session = await auth()
    const upstream = await nativeAdminRequest({ baseUrl: backendBaseUrl(), path, method, searchParams, body,
      getToken: options => session.getToken(options?.skipCache ? { expiresInSeconds: 60 } : undefined) })
    // Native errors never include response previews, provider bodies or secrets.
    const payload = await readJsonResponse(upstream)
    return { payload, upstream }
  }
  const url = new URL(`${backendBaseUrl()}${path}`)
  if (searchParams) {
    for (const [key, value] of searchParams.entries()) {
      url.searchParams.append(key, value)
    }
  }

  let upstream: Response
  try {
    upstream = await fetch(url, {
      method,
      headers: backendHeaders({
        includeJsonContentType: method !== 'GET',
        requireBackendServiceToken,
        includeCloudflareAccess,
      }),
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown backend request error.'
    throw new BackendProxyError(
      'BACKEND_REQUEST_FAILED',
      `Failed to reach backend: ${message}`,
      502
    )
  }

  try {
    const payload = await readJsonResponse(upstream)
    return { payload, upstream }
  } catch (error) {
    if (error instanceof JsonResponseParseError) {
      if (error.kind === 'non_json_content_type') {
        throw new BackendProxyError(
          'UPSTREAM_NON_JSON_RESPONSE',
          'Backend returned HTML/non-JSON. Check BACKEND_BASE_URL, auth token, route path, or deployment.',
          502,
          {
            upstreamStatus: error.responseStatus,
            upstreamContentType: error.contentType,
            upstreamBodyPreview: error.bodyPreview,
          }
        )
      }

      throw new BackendProxyError(
        'UPSTREAM_INVALID_JSON_RESPONSE',
        'Backend declared JSON but returned an invalid JSON body.',
        502,
        {
          upstreamStatus: error.responseStatus,
          upstreamContentType: error.contentType,
          upstreamBodyPreview: error.bodyPreview,
        }
      )
    }

    throw error
  }
}

export async function proxyBackendJson(options: ProxyBackendJsonOptions): Promise<NextResponse> {
  const { payload, upstream } = await requestBackendJson(options)
  return NextResponse.json(payload, { status: upstream.status, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function proxyCanonicalTickerResource({
  resource,
  searchParams,
}: {
  resource: string
  searchParams: URLSearchParams
}): Promise<NextResponse> {
  const symbol = (searchParams.get('symbol') || '').trim().toUpperCase()
  if (!symbol) {
    return NextResponse.json(
      { error: 'SYMBOL_REQUIRED', message: 'symbol is required.', statusCode: 400 },
      { status: 400 },
    )
  }

  const forwarded = new URLSearchParams(searchParams)
  forwarded.delete('symbol')
  return proxyBackendJson({
    path: `/tickers/${encodeURIComponent(symbol)}/${resource}`,
    method: 'GET',
    searchParams: forwarded,
    requireBackendServiceToken: true,
  })
}

export async function proxyResearchBackendJson(options: Omit<ProxyBackendJsonOptions, 'requireBackendServiceToken' | 'includeCloudflareAccess'>): Promise<NextResponse> {
  return proxyBackendJson({
    ...options,
    requireBackendServiceToken: true,
    includeCloudflareAccess: true,
  })
}

export function toBackendProxyErrorPayload(error: unknown): BackendProxyErrorPayload {
  if (error instanceof BackendProxyError) {
    const details = error.details ?? {}
    return {
      error: error.code,
      message: error.message,
      statusCode: error.statusCode,
      upstreamStatus: readNumericDetail(details.upstreamStatus),
      upstreamContentType: readStringDetail(details.upstreamContentType),
      upstreamBodyPreview: readStringDetail(details.upstreamBodyPreview),
      details: Object.keys(details).length > 0 ? details : undefined,
    }
  }

  const code = error instanceof Error ? error.message : 'UNKNOWN_BACKEND_PROXY_ERROR'
  if (code === 'BACKEND_BASE_URL_MISSING') {
    return {
      error: 'BACKEND_CONFIGURATION_MISSING',
      message: 'BACKEND_BASE_URL or FINANCE_BACKEND_URL is not configured.',
      statusCode: 502,
    }
  }
  if (code === 'BACKEND_SERVICE_TOKEN_MISSING') {
    return {
      error: 'BACKEND_SERVICE_TOKEN_MISSING',
      message: 'BACKEND_SERVICE_TOKEN is required for this backoffice route.',
      statusCode: 502,
    }
  }
  if (code === 'CF_ACCESS_SERVICE_TOKEN_INCOMPLETE') {
    return {
      error: 'CF_ACCESS_SERVICE_TOKEN_INCOMPLETE',
      message: 'Cloudflare Access service token is partially configured. Set both client ID and client secret.',
      statusCode: 502,
    }
  }

  return {
    error: 'BACKEND_PROXY_ERROR',
    message: error instanceof Error ? error.message : 'Unknown backend proxy error.',
    statusCode: 502,
  }
}

export function backendProxyErrorResponse(error: unknown): NextResponse {
  const payload = toBackendProxyErrorPayload(error)
  return NextResponse.json(payload, { status: payload.statusCode })
}

export async function withAdminRoute(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    await requireAdminUser()
  } catch (error) {
    const mapped = mapAuthErrorStatus(error)
    return NextResponse.json({ error: mapped.message, message: mapped.message, statusCode: mapped.status }, { status: mapped.status })
  }

  try {
    return await handler()
  } catch (error) {
    return backendProxyErrorResponse(error)
  }
}

function readStringDetail(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function readNumericDetail(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}
