import { NextRequest } from 'next/server'
import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET(request: NextRequest) {
  return withAdminRoute(async () => proxyBackendJson({
    path: '/data-control/coverage',
    method: 'GET',
    searchParams: request.nextUrl.searchParams,
  }))
}
