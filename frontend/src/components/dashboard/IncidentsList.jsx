import { Card } from '../ui'
import { formatDistanceToNow } from 'date-fns'

export default function IncidentsList({ allResults, monitors }) {
  // Collect all DOWN results across all monitors
  const incidents = allResults
    .flatMap(({ monitorId, results }) =>
      results
        .filter(r => !r.is_up)
        .map(r => ({
          ...r,
          monitorName: monitors.find(m => m.id === monitorId)?.name || `Monitor #${monitorId}`,
        }))
    )
    .sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at))
    .slice(0, 10)

  return (
    <Card style={{ padding: '24px' }}>
      <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Recent Incidents
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          background: 'var(--red-dim)', color: 'var(--red)',
          padding: '3px 8px', borderRadius: 6,
          border: '1px solid rgba(255,77,106,0.2)',
        }}>
          {incidents.length} DOWN events
        </div>
      </div>

      {incidents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
          <div style={{ fontSize: 13 }}>No incidents — everything looks good!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {incidents.map((inc, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', borderRadius: 10,
              background: 'var(--red-dim)', border: '1px solid rgba(255,77,106,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--red)', fontSize: 14 }}>↓</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{inc.monitorName}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    {inc.error || `HTTP ${inc.status_code}`}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
                {formatDistanceToNow(new Date(inc.checked_at), { addSuffix: true })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
