import { NextRequest } from 'next/server'
import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET(request: NextRequest) {
  return withAdminRoute(async () => {
    return proxyBackendJson({
      path: '/relationship-map/source-health',
      method: 'GET',
      searchParams: request.nextUrl.searchParams,
    })
  })
}
