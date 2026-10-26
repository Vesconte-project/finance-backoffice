import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import DailyInferenceWorkspace from './ui'

export default async function DailyInferencePage() {
  const admin = await requireAdminUser()
  return (
    <div>
      <div className="card">
        <div className="split-row">
          <div>
            <h1>Production Daily Inference</h1>
            <p className="small">Production job visibility per active pointer and date.</p>
          </div>
          <div className="meta">
            <Link href="/production" className="text-link">Production</Link>
            <span className="small">Admin: {admin.userId}</span>
          </div>
        </div>
      </div>
      <DailyInferenceWorkspace />
    </div>
  )
}
