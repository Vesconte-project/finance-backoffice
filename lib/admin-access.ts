import { requireAdminUser } from './admin-auth'
import { NativeAdminError } from './native-admin-client'

export type AdminAccess =
  | { status: 'authorized'; userId: string }
  | { status: 'signed-out' }
  | { status: 'denied' }
  | { status: 'unavailable' }

export async function resolveAdminAccess(check = requireAdminUser): Promise<AdminAccess> {
  try { return { status: 'authorized', ...(await check()) } }
  catch (error) {
    if (error instanceof NativeAdminError && error.status === 401) return { status: 'signed-out' }
    if (error instanceof NativeAdminError && error.status === 403) return { status: 'denied' }
    return { status: 'unavailable' }
  }
}
