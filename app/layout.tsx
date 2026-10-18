import type { Metadata } from 'next'
import { ClerkProvider, SignInButton, UserButton } from '@clerk/nextjs'
import { auth } from '@clerk/nextjs/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { grayHealth } from '@/lib/sidebar-state'
import './globals.css'

export const metadata: Metadata = {
  title: 'Spy Signal Backoffice',
  description: 'Admin-only operations console',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  const app = (
    <html lang="en">
      <body>
        <div className="app-shell">
          <Sidebar
            health={grayHealth()}
            loadStatus={Boolean(userId)}
          />
          <div className="app-main">
            <div className="auth-row">
              {userId ? <UserButton /> : <SignInButton />}
            </div>
            <main className="container main">{children}</main>
          </div>
        </div>
      </body>
    </html>
  )

  return <ClerkProvider>{app}</ClerkProvider>
}
