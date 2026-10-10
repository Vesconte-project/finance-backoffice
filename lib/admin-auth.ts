import { auth, currentUser } from '@clerk/nextjs/server'
import { nativeAdminEnabled, nativeAdminRequest, NativeAdminError } from './native-admin-client'

type AdminContext = {
  userId: string
  email: string
}

function parseAllowlist(): Set<string> {
  const raw = process.env.ADMIN_EMAIL_ALLOWLIST ?? ''
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function isAdminAuthBypassEnabled(): boolean {
  if (nativeAdminEnabled()) return false
  // Local automation/debugging only. Production must always go through Clerk.
  return process.env.NODE_ENV !== 'production' && process.env.ADMIN_AUTH_BYPASS === 'true'
}

export async function requireAdminUser(): Promise<AdminContext> {
  if (nativeAdminEnabled()) {
    const session = await auth()
    if (!session.userId) throw new NativeAdminError(401)
    const response = await nativeAdminRequest({ baseUrl: process.env.BACKEND_BASE_URL || process.env.FINANCE_BACKEND_URL || '', path: '/me',
      getToken: options => session.getToken(options?.skipCache ? { expiresInSeconds: 60 } : undefined) })
    const access = await response.json()
    if (typeof access.user_id !== 'string' || !/^[0-9a-f-]{36}$/.test(access.user_id) || !Array.isArray(access.permissions) ||
      !access.permissions.includes('backoffice.access')) throw new NativeAdminError(503)
    // Email is display information only; the Backend has already authorized the actor.
    const user = await currentUser().catch(() => null)
    return { userId: session.userId, email: readPrimaryEmail(user) || access.user_id }
  }
  if (isAdminAuthBypassEnabled()) {
    return {
      userId: 'local-admin-bypass',
      email: readBypassEmail(),
    }
  }

  const { userId } = await auth()
  if (!userId) {
    throw new Error('UNAUTHORIZED')
  }

  const allowlist = parseAllowlist()
  if (allowlist.size === 0) {
    throw new Error('ADMIN_NOT_CONFIGURED')
  }

  const user = await currentUser()
  const email = readPrimaryEmail(user)
  if (!email) {
    throw new Error('EMAIL_MISSING')
  }

  if (!allowlist.has(email)) {
    throw new Error('FORBIDDEN')
  }

  return {
    userId,
    email,
  }
}

function readBypassEmail(): string {
  return [...parseAllowlist()][0] ?? 'local-admin@example.com'
}

function readPrimaryEmail(user: Awaited<ReturnType<typeof currentUser>>): string | null {
  const primaryEmail = user?.emailAddresses?.find((email) => email.id === user.primaryEmailAddressId)
  return (primaryEmail ?? user?.emailAddresses?.[0])?.emailAddress?.toLowerCase().trim() ?? null
}

export function mapAuthErrorStatus(error: unknown): { status: number; message: string } {
  if (error instanceof NativeAdminError) return { status: error.status, message: error.message }
  const code = error instanceof Error ? error.message : 'UNKNOWN'
  if (code === 'UNAUTHORIZED') {
    return { status: 401, message: 'Authentication required.' }
  }
  if (code === 'ADMIN_NOT_CONFIGURED') {
    return { status: 500, message: 'Admin allowlist is not configured.' }
  }
  if (code === 'FORBIDDEN') {
    return { status: 403, message: 'Admin access required.' }
  }
  if (code === 'EMAIL_MISSING') {
    return { status: 403, message: 'No verified email found for user.' }
  }
  return { status: 500, message: 'Authorization check failed.' }
}
