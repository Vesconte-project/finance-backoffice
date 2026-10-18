import { requireAdminUser } from '@/lib/admin-auth'
import ResourceAccessForm from '@/components/resource-access/ResourceAccessForm'

export default async function ResearchPage() {
  await requireAdminUser()
  return <div className="page-stack"><h1>Research support</h1>
    <p>General research lists and private result views have been removed.</p>
    <ResourceAccessForm /></div>
}
