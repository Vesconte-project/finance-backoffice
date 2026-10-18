import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET() {
  return withAdminRoute(() => proxyBackendJson({ path: '/analyst/registry/monitoring/snapshots', method: 'GET',
    searchParams: new URLSearchParams({ environment: 'production', limit: '100' }) }))
}
