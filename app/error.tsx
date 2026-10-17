'use client'

export default function AdministrativeError({ reset }: { error: Error; reset: () => void }) {
  return <section className="card" role="alert"><h1>Administrative access is unavailable</h1>
    <p>Sign in with an authorised account or try again later.</p>
    <button type="button" onClick={reset}>Try again</button></section>
}
