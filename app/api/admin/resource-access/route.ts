import { NextResponse } from 'next/server'
import { readResourceAccessBody, ResourceAccessInputError } from '@/lib/admin-resource-access'
import { requestBackendResponse, withAdminRoute } from '@/lib/backend-client'

export async function POST(request: Request) {
  return withAdminRoute(async () => {
    let body: unknown
    try { body = await readResourceAccessBody(request) } catch (error) {
      return NextResponse.json({ message: 'Invalid resource access request.' }, { status: error instanceof ResourceAccessInputError ? error.status : 400,
        headers: { 'Cache-Control': 'private, no-store' } })
    }
    const upstream = await requestBackendResponse({ path: '/resource-access', method: 'POST', body })
    const headers = new Headers({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
    for (const name of ['Content-Type', 'Content-Length', 'Content-Disposition', 'X-Audit-Id']) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers })
  })
}
