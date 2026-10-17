import { auth } from '@clerk/nextjs/server'
import { nativeAdminRequest, NativeAdminError } from './native-admin-client'

type AdminContext = { userId: string }

export async function requireAdminUser(): Promise<AdminContext> {
  const session = await auth()
  if (!session.userId) throw new NativeAdminError(401)
  const response = await nativeAdminRequest({
    baseUrl: process.env.BACKEND_BASE_URL || process.env.FINANCE_BACKEND_URL || '',
    path: '/me',
    getToken: options => session.getToken(options?.skipCache ? { expiresInSeconds: 60 } : undefined),
  })
  let access: unknown
  try { access = await response.json() } catch { throw new NativeAdminError(503) }
  if (!access || typeof access !== 'object' || !('user_id' in access) || !('permissions' in access) ||
      typeof access.user_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(access.user_id) ||
      !Array.isArray(access.permissions) || !access.permissions.every(value => typeof value === 'string') ||
      !access.permissions.includes('backoffice.access')) throw new NativeAdminError(503)
  // The backend returns the verified internal actor. No email lookup is needed.
  return { userId: access.user_id }
}

export function mapAuthErrorStatus(error: unknown): { status: number; message: string } {
  if (error instanceof NativeAdminError) return { status: error.status, message: error.message }
  return { status: 503, message: 'Administrative authorization is unavailable.' }
}
