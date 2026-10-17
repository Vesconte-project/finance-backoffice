export default function FrontofficeWorkspace({ adminEmail }: { adminEmail: string }) {
  return (
    <div className="page-stack">
      <div className="card">
        <h1>Frontoffice</h1>
        <p className="small">Admin: {adminEmail}</p>
      </div>
      <div className="card">
        <h2>Private user activity</h2>
        <p>Watchlists, alerts and research history are private. User lookup is unavailable.</p>
      </div>
    </div>
  )
}
