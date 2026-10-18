import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'

export default async function AnalystPage() {
  await requireAdminUser()
  return <section className="card"><h1>Analyst</h1>
    <p>General job history and private results are unavailable.</p>
    <Link href="/data">Open operational data tools</Link></section>
}
