import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'

export default async function HomePage() {
  const actor = await requireAdminUser()
  return <div className="page-stack">
    <section className="card"><h1>Operations</h1><p>Signed in as {actor.userId}</p></section>
    <section className="card"><h2>Operational tools</h2>
      <nav className="page-stack">
        <Link href="/data">Data coverage and operational jobs</Link>
        <Link href="/production">Published production models</Link>
        <Link href="/research">Exceptional access to one private resource</Link>
        <Link href="/operations">Infrastructure health</Link>
      </nav>
    </section>
    <section className="card"><p>Candidate and readiness views are unavailable until the registry records ownership and explicit submission.</p></section>
  </div>
}
