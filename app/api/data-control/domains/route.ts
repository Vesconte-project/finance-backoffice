import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET() {
  return withAdminRoute(async () => proxyBackendJson({
    path: '/data-control/domains',
    method: 'GET',
  }))
}
