import { NextRequest } from 'next/server'
import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET(request: NextRequest) {
  return withAdminRoute(async () => {
    return proxyBackendJson({
      path: '/analyst/production/daily-inference',
      method: 'GET',
      searchParams: new URLSearchParams({ environment: 'production', ...Object.fromEntries(['status', 'universe', 'limit', 'offset'].flatMap((key) => { const value = request.nextUrl.searchParams.get(key); return value === null ? [] : [[key, value]] })) }),
    })
  })
}
