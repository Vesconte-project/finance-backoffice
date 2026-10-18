import { NextRequest } from 'next/server'
import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  return withAdminRoute(async () => {
    const { jobId } = await context.params
    return proxyBackendJson({
      path: `/analyst/production/daily-inference/${encodeURIComponent(jobId)}`,
      method: 'GET',
      searchParams: request.nextUrl.searchParams,
    })
  })
}
