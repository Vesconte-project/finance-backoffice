import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET() {
  return withAdminRoute(() => proxyBackendJson({ path: '/analyst/registry/active-pointers', method: 'GET',
    searchParams: new URLSearchParams({ environment: 'production' }) }))
}
