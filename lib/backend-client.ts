import { NextResponse } from 'next/server'
import { mapAuthErrorStatus, requireAdminUser } from './admin-auth'
import { NativeAdminError, nativeAdminJson, nativeAdminRequest } from './native-admin-client'

type ProxyBackendJsonOptions = {
  path: string
  method?: 'GET' | 'POST'
  searchParams?: URLSearchParams
  body?: unknown

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

export function backendBaseUrl(): string {
  const base = (process.env.BACKEND_BASE_URL || '').trim()
  if (!base) {
    throw new Error('BACKEND_BASE_URL_MISSING')
  }
  return base.replace(/\/$/, '')
}

export function backendBaseUrlConfigured(): boolean {
  return Boolean((process.env.BACKEND_BASE_URL || '').trim())
}

export async function requestBackendJson({ path, method = 'GET', searchParams, body }: ProxyBackendJsonOptions): Promise<{ payload: unknown; upstream: Response }> {
  const { auth } = await import('@clerk/nextjs/server')
  const session = await auth()
  if (!session.userId) throw new NativeAdminError(401)
  return nativeAdminJson({ baseUrl: backendBaseUrl(), path, method, searchParams, body,
    getToken: options => session.getToken(options?.skipCache ? { expiresInSeconds: 60 } : undefined) })

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

  })
}

export function toBackendProxyErrorPayload(error: unknown): BackendProxyErrorPayload {
  if (error instanceof NativeAdminError) return {
    error: 'ADMINISTRATIVE_REQUEST_REFUSED', message: error.message, statusCode: error.status,
  }
  return { error: 'BACKEND_PROXY_ERROR', message: 'Administrative service is unavailable.', statusCode: 502 }
}

export function backendProxyErrorResponse(error: unknown): NextResponse {
  const payload = toBackendProxyErrorPayload(error)
  return NextResponse.json(payload, { status: payload.statusCode, headers: { 'Cache-Control': 'private, no-store',
    ...(error instanceof NativeAdminError && error.retryAfter ? { 'Retry-After': error.retryAfter } : {}) } })
}

export async function withAdminRoute(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    await requireAdminUser()
  } catch (error) {
    const mapped = mapAuthErrorStatus(error)
    return NextResponse.json({ error: mapped.message, message: mapped.message, statusCode: mapped.status }, { status: mapped.status,
      headers: { 'Cache-Control': 'private, no-store', ...(error instanceof NativeAdminError && error.retryAfter ? { 'Retry-After': error.retryAfter } : {}) } })
  }

  try {
    return await handler()
  } catch (error) {
    return backendProxyErrorResponse(error)
  }
}

export async function requestBackendResponse(options: ProxyBackendJsonOptions): Promise<Response> {
  const { auth } = await import('@clerk/nextjs/server')
  const session = await auth()
  if (!session.userId) throw new NativeAdminError(401)
  return nativeAdminRequest({ ...options, baseUrl: backendBaseUrl(),
    getToken: value => session.getToken(value?.skipCache ? { expiresInSeconds: 60 } : undefined) })
}
