import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET() {
  return withAdminRoute(() => proxyBackendJson({ path: '/analyst/research/capabilities', method: 'GET' }))
}
