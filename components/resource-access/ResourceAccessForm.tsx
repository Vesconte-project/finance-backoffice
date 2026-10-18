"use client"

import { useEffect, useState, type FormEvent } from 'react'

const kinds = [
  ['ai_run', 'AI research run'], ['research_job', 'Research job'],
  ['research_experiment', 'Research experiment'], ['research_artifact', 'Research artifact'],
  ['experiment_artifact', 'Experiment artifact'],
] as const

export default function ResourceAccessForm() {
  const [kind, setKind] = useState<string>('research_experiment')
  const [identifier, setIdentifier] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<unknown>(null)
  const [download, setDownload] = useState<string | null>(null)
  useEffect(() => () => { if (download) URL.revokeObjectURL(download) }, [download])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(''); setResult(null); setDownload(null)
    try {
      const response = await fetch('/api/admin/resource-access', {
        method: 'POST', cache: 'no-store', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_type: kind, resource_id: identifier.trim(), reason: reason.trim() }),
      })
      if (!response.ok) throw new Error(response.status === 403 ? 'This access requires an explicit administrative permission.' :
        response.status === 404 ? 'Resource not found.' : response.status === 401 ? 'Sign in again to continue.' :
        'Exceptional access is unavailable. No privileged fallback is used.')
      if (response.headers.get('Content-Type')?.includes('application/json')) {
        const payload: unknown = await response.json()
        setResult(response.headers.get('X-Audit-Id') ? { audit_id: response.headers.get('X-Audit-Id'), resource_id: identifier.trim(), data: payload } : payload)
      }
      else {
        setDownload(URL.createObjectURL(await response.blob()))
        setResult({ audit_id: response.headers.get('X-Audit-Id'), resource_id: identifier.trim() })
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Exceptional access is unavailable.') }
    finally { setBusy(false) }
  }
  return <section className="card">
    <h2>Exceptional resource access</h2>
    <p>One concrete resource, an explicit reason and a durable audit decision before any data is returned.</p>
    <p>Watchlists, alerts, candidate browsing and bulk exports are unavailable.</p>
    <form onSubmit={submit} className="page-stack">
      <label>Resource type<select value={kind} onChange={event => setKind(event.target.value)}>
        {kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Resource ID<input required value={identifier} maxLength={128}
        pattern="[A-Za-z0-9][A-Za-z0-9_.:\-]*" onChange={event => setIdentifier(event.target.value)} /></label>
      <label>Reason<textarea required minLength={1} maxLength={500} value={reason}
        onChange={event => setReason(event.target.value)} /></label>
      <button type="submit" disabled={busy || !reason.trim() || !identifier.trim()}>{busy ? 'Checking access…' : 'Access this resource'}</button>
    </form>
    {error ? <p role="alert">{error}</p> : null}
    {result ? <pre>{JSON.stringify(result, null, 2)}</pre> : null}
    {download ? <a href={download} download="research-artifact.bin">Download the audited artifact</a> : null}
  </section>
}
