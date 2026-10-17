import DataWorkspace from '@/components/data/DataWorkspace'
import { requireAdminUser } from '@/lib/admin-auth'

type PageProps = {
  searchParams?: Promise<{ domain?: string; entity?: string; month?: string }>
}

export default async function DataPage({ searchParams }: PageProps) {
  const admin = await requireAdminUser()
  const resolvedSearchParams = await searchParams
  const month = validMonth(resolvedSearchParams?.month) ? resolvedSearchParams.month : new Date().toISOString().slice(0, 7)

  return (
    <DataWorkspace
      adminActor={admin.userId}
      initialDomain={resolvedSearchParams?.domain}
      initialEntity={resolvedSearchParams?.entity}
      initialMonth={month}
    />
  )
}

function validMonth(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}$/.test(value))
}
