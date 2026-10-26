import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'Spy Signal Backoffice',
  description: 'Admin-only operations console',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><ClerkProvider>{children}</ClerkProvider></body></html>
}
