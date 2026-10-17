import { readJsonResponse } from './http-json'

type GetToken = (options?: { skipCache?: boolean }) => Promise<string | null>
type Options = { baseUrl: string; path: string; method?: 'GET' | 'POST'; searchParams?: URLSearchParams;
  body?: unknown; getToken: GetToken; fetcher?: typeof fetch }
export class NativeAdminError extends Error {
  constructor(readonly status: number, readonly retryAfter?: string | null) {
    super(status === 401 ? 'Authentication required.' : status === 403 ? 'Administrative permission required.' :
      'Administrative service is unavailable.')
  }
}
export async function nativeAdminRequest({ baseUrl, path, method = 'GET', searchParams, body, getToken, fetcher = fetch }: Options) {
  let url: URL
  try {
    const base = new URL(baseUrl)
    if (base.username || base.password || base.search || base.hash || base.pathname !== '/' ||
      !(base.protocol === 'https:' || (base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname)))) throw Error()
    const decoded = decodeURIComponent(path)
    if (decoded.includes('\\') || decoded.includes('?') || decoded.includes('#') ||
      /(?:^|\/)\.{1,2}(?:\/|$)/.test(decoded) || /%2f|%5c/i.test(path) ||
      !(['/me', '/contracts', '/fund-rebalances', '/resource-access'].includes(path) || /^\/(?:analyst|tickers|signals|screener|relationships|entities|data-control|ops)\//.test(path) || /^\/network(?:\/|$)/.test(path)) ||
      path.startsWith('/site/research/synthetic')) throw Error()
    url = new URL(`${base.origin}/v1/admin${path}`)
    if (searchParams) for (const [key, value] of searchParams) url.searchParams.append(key, value)
  } catch { throw new NativeAdminError(503) }
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getToken(attempt ? { skipCache: true } : undefined)
    if (!token) throw new NativeAdminError(401)
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    let response: Response
    try {
      response = await fetcher(url, { method, headers, credentials: 'omit', cache: 'no-store', redirect: 'error',
        signal: AbortSignal.timeout(35000), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
    } catch { throw new NativeAdminError(502) }
    if (response.status === 401 && attempt === 0) continue
    if (!response.ok) throw new NativeAdminError(response.status, response.status === 429 && /^\d{1,5}$/.test(response.headers.get('retry-after') || '') ? response.headers.get('retry-after') : null)
    return response
  }
  throw new NativeAdminError(401)
}

export async function nativeAdminJson(options: Options): Promise<{ payload: unknown; upstream: Response }> {
  const upstream = await nativeAdminRequest(options)
  try { return { payload: await readJsonResponse(upstream), upstream } }
  catch { throw new NativeAdminError(502) }
}
