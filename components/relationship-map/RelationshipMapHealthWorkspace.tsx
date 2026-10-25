'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { requestClientJson } from '@/lib/client-json'
import { healthLabel, parseWeeklyHealth, type WeeklyHealth } from '@/lib/atlas-weekly-admin'
import { RelationshipMapCoveragePanel } from '@/components/relationship-map/RelationshipMapCoveragePanel'
import { RelationshipMapFrontierPanel } from '@/components/relationship-map/RelationshipMapFrontierPanel'

type WorkspaceTab = 'source-health' | 'coverage' | 'frontier'
export function RelationshipMapHealthWorkspace({ adminActor }: { adminActor: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requested = searchParams.get('tab')
  const activeTab: WorkspaceTab = requested === 'coverage' || requested === 'frontier' ? requested : 'source-health'
  const [health, setHealth] = useState<WeeklyHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (activeTab !== 'source-health') return
    let cancelled = false
    async function load() {
      setLoading(true)
      setFailed(false)
      try {
        const result = parseWeeklyHealth(await requestClientJson('/api/relationship-map/source-health'))
        if (!cancelled) setHealth(result)
      } catch {
        if (!cancelled) { setHealth(null); setFailed(true) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [activeTab])
  function selectTab(tab: WorkspaceTab) {
    const params = new URLSearchParams(searchParams.toString())
    for (const key of ['window', 'layer', 'freshPriceDays', 'minTickerCount']) params.delete(key)
    if (tab === 'source-health') params.delete('tab')
    else params.set('tab', tab)
    const query = params.toString()
    router.replace(query ? `/relationship-map?${query}` : '/relationship-map', { scroll: false })
  }
  return (
    <div className="page-stack">
      <div className="card split-row">
        <div><h1>Weekly Atlas</h1><p className="small">Published week, universe coverage, and growth frontier.</p></div>
        <div className="small">Admin: {adminActor}</div>
      </div>
      <nav className="relationship-map-tabs" aria-label="Atlas workspace sections">
        {([['source-health', 'Weekly health'], ['coverage', 'Coverage'], ['frontier', 'Frontier / Grow']] as const).map(([tab, label]) => (
          <button key={tab} type="button" aria-current={activeTab === tab ? 'page' : undefined}
            className={activeTab === tab ? 'active' : ''} onClick={() => selectTab(tab)}>{label}</button>
        ))}
      </nav>
      {activeTab === 'coverage' ? <RelationshipMapCoveragePanel /> : null}
      {activeTab === 'frontier' ? <RelationshipMapFrontierPanel /> : null}
      {activeTab === 'source-health' ? (
        <section className="card" aria-label="Weekly Atlas health" aria-busy={loading}>
          {loading ? <p role="status">Checking the latest published week…</p> :
            failed || !health ? <p role="alert">Weekly Atlas health is unavailable. Reload this page to retry.</p> : (
              <>
                <h2>{healthLabel[health.status]}</h2>
                <dl className="field-grid">
                  <div><dt>Expected week starts</dt><dd>{health.expectedWeekStart}</dd></div>
                  <div><dt>Expected close</dt><dd>{health.expectedAsOf ?? 'Calendar unavailable'}</dd></div>
                  <div><dt>Latest published close</dt><dd>{health.latestAsOf ?? 'None published'}</dd></div>
                  <div><dt>Companies</dt><dd>{health.companyCount.toLocaleString()}</dd></div>
                  <div><dt>Zones</dt><dd>{health.zoneCount.toLocaleString()}</dd></div>
                </dl>
              </>
            )}
        </section>
      ) : null}
    </div>
  )
}
