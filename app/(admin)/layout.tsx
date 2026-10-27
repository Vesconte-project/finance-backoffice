import { SignInButton, SignOutButton, UserButton } from '@clerk/nextjs'
import { resolveAdminAccess } from '@/lib/admin-access'
import { grayHealth } from '@/lib/sidebar-state'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await resolveAdminAccess()
  if (access.status !== 'authorized') {
    return <main className="container main" data-admin-refusal="">
      <h1>{access.status === 'unavailable' ? 'Administrative access is temporarily unavailable' : 'Administrative access required'}</h1>
      <p>{access.status === 'signed-out' ? 'Sign in with an authorized administrative account.' :
        access.status === 'denied' ? 'This account does not have permission to use the backoffice.' :
        'Your access could not be verified. Try again later.'}</p>
      {access.status === 'signed-out' ? <SignInButton><button type="button">Sign in</button></SignInButton> :
        <SignOutButton redirectUrl="/"><button type="button">Sign out</button></SignOutButton>}
    </main>
  }
  // Import the panel navigation only after the backend confirms administration.
  const { Sidebar } = await import('@/components/layout/Sidebar')
  return <div className="app-shell">
    <Sidebar health={grayHealth()} loadStatus />
    <div className="app-main">
      <div className="auth-row"><UserButton /></div>
      <main className="container main">{children}</main>
    </div>
  </div>
}
