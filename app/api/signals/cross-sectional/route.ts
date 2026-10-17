import { NextRequest } from 'next/server'
import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET(request: NextRequest) {
  return withAdminRoute(async () => {
    return proxyBackendJson({
      path: '/signals/cross-sectional',
      method: 'GET',
      searchParams: request.nextUrl.searchParams,
    })
  })
}
