'use client'
import { useEffect, useState } from 'react'
import { requestClientJson } from '@/lib/client-json'
import { parseWeeklyCoverage, type WeeklyCoverage } from '@/lib/atlas-weekly-admin'

export function RelationshipMapCoveragePanel() {
  const [coverage, setCoverage] = useState<WeeklyCoverage | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const result = parseWeeklyCoverage(await requestClientJson('/api/relationship-map/coverage'))
        if (!cancelled) setCoverage(result)
      } catch {
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])
  return (
    <section className="card" aria-label="Weekly Atlas coverage" aria-busy={loading}>
      <h2>Universe coverage</h2>
      {loading ? <p role="status">Loading coverage for the latest published week…</p> :
        failed || !coverage ? <p role="alert">Weekly Atlas coverage is unavailable. Reload this page to retry.</p> : (
          <>
            <p className="small">Current registered universe compared with the closed week published on {coverage.asOf ?? '—'}.</p>
            {coverage.asOf === null ? <p role="status">No closed week has been published. Coverage is not yet available.</p> : (
              <>
                <dl className="field-grid">
                  <div><dt>Registered companies</dt><dd>{coverage.universeCount.toLocaleString()}</dd></div>
                  <div><dt>On the Atlas</dt><dd>{coverage.nodeCount.toLocaleString()}</dd></div>
                  <div><dt>Outside this snapshot</dt><dd>{coverage.excludedCount?.toLocaleString() ?? 'Unknown'}</dd></div>
                </dl>
                {!coverage.exclusionReasonsAvailable ? <p className="small">Exclusion reasons were not recorded for this snapshot.</p> : (
                  <ul>{coverage.exclusionReasons.map(({ reason, count }) => <li key={reason ?? 'unknown'}>{reason ?? 'Unknown reason'}: {count.toLocaleString()}</li>)}</ul>
                )}
                {coverage.countries.length === 0 ? <p>No companies are registered in the current universe.</p> : (
                  <div className="table-wrap"><table className="registry-table">
                    <caption>Coverage by country for the published week</caption>
                    <thead><tr><th scope="col">Country</th><th scope="col">Region</th><th scope="col">Registered</th><th scope="col">On Atlas</th><th scope="col">Outside snapshot</th><th scope="col">Coverage</th></tr></thead>
                    <tbody>{coverage.countries.map(row => <tr key={`${row.country}:${row.region}`}>
                      <th scope="row">{row.country}</th><td>{row.region}</td><td>{row.universeCount.toLocaleString()}</td>
                      <td>{row.nodeCount.toLocaleString()}</td><td>{row.excludedCount?.toLocaleString() ?? 'Unknown'}</td>
                      <td>{row.coverageRatio === null ? 'Unknown' : `${(row.coverageRatio * 100).toFixed(1)}%`}</td>
                    </tr>)}</tbody>
                  </table></div>
                )}
              </>
            )}
          </>
        )}
    </section>
  )
}
