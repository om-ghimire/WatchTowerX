import { Panel } from '../ui'
import { formatDistanceToNow } from 'date-fns'
import { parseServerTimestamp } from '../../lib/dates'

// Walk a monitor's check history in chronological order and emit only the
// state *transitions* (down / recovered) — not every raw check — so the
// feed reads as a log of events, not a firehose of individual pings.
function transitionsFor(monitorId, results, monitorName) {
  const sorted = [...results].sort((a, b) => new Date(a.checked_at) - new Date(b.checked_at))
  const events = []
  let prev
  for (const r of sorted) {
    if (prev === undefined) {
      if (!r.is_up) events.push({ ...r, monitorName, type: 'down' })
    } else if (prev !== r.is_up) {
      events.push({ ...r, monitorName, type: r.is_up ? 'recovered' : 'down' })
    }
    prev = r.is_up
  }
  return events
}

export default function IncidentsList({ allResults, monitors }) {
  const events = allResults
    .flatMap(({ monitorId, results }) =>
      transitionsFor(monitorId, results, monitors.find(m => m.id === monitorId)?.name || `Monitor #${monitorId}`)
    )
    .sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at))
    .slice(0, 8)

  return (
    <Panel style={{ padding: '18px 20px' }}>
      <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Event Feed
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--faint)' }}>
          LIVE
        </div>
      </div>

      {events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>
          No events yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {events.map((ev, i) => {
            const isDown = ev.type === 'down'
            const color = isDown ? 'var(--red)' : 'var(--green)'
            return (
              <div key={i} className="stream-in" style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '9px 0',
                borderBottom: i < events.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                animationDelay: `${i * 30}ms`,
              }}>
                <span style={{ color, fontSize: 12, fontFamily: 'var(--font-mono)', marginTop: 1 }}>{isDown ? '↓' : '↑'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{ev.monitorName}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isDown ? (ev.error || `HTTP ${ev.status_code}`) : 'Recovered'}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--faint)', whiteSpace: 'nowrap' }}>
                  {formatDistanceToNow(parseServerTimestamp(ev.checked_at), { addSuffix: true })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}
