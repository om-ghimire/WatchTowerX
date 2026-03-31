import { useState, useCallback } from 'react'
import { monitorsApi, resultsApi } from '../lib/api'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { Card, Spinner } from '../components/ui'
import { formatDistanceToNow, format } from 'date-fns'

export default function IncidentsPage() {
  const [monitors, setMonitors]     = useState([])
  const [allResults, setAllResults] = useState([])
  const [loading, setLoading]       = useState(true)

  const fetchAll = useCallback(async () => {
    try {
      const mons = await monitorsApi.list()
      setMonitors(mons)
      const resultsArr = await Promise.all(
        mons.map(m => resultsApi.history(m.id, 200).then(r => ({ monitorId: m.id, results: r })).catch(() => ({ monitorId: m.id, results: [] })))
      )
      setAllResults(resultsArr)
    } finally { setLoading(false) }
  }, [])

  useAutoRefresh(fetchAll, 30000)

  const incidents = allResults
    .flatMap(({ monitorId, results }) =>
      results.filter(r => !r.is_up).map(r => ({
        ...r,
        monitorName: monitors.find(m => m.id === monitorId)?.name || `#${monitorId}`,
        monitorUrl:  monitors.find(m => m.id === monitorId)?.url,
      }))
    )
    .sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at))

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
      <div style={{ marginBottom: 28 }} className="fade-up">
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Incidents</h1>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>All downtime events across your monitors</div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><Spinner size={36} /></div>
      ) : incidents.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 80 }} className="fade-up">
          <div style={{ fontSize: 48, marginBottom: 16, color: 'var(--green)' }}>✓</div>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>No incidents recorded</h2>
          <p style={{ color: 'var(--muted)' }}>All your monitors are reporting healthy.</p>
        </div>
      ) : (
        <Card className="fade-up-2" style={{ padding: '8px 0', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1.5fr',
            padding: '10px 24px', borderBottom: '1px solid var(--border)',
            fontSize: 11, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            <div>Monitor</div><div>Error</div><div>Status</div><div>Response</div><div>Time</div>
          </div>
          {incidents.map((inc, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1.5fr',
              padding: '14px 24px', borderBottom: '1px solid var(--border)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,77,106,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{inc.monitorName}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{inc.monitorUrl}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--red)', alignSelf: 'center', fontFamily: 'var(--font-mono)' }}>
                {inc.error || '—'}
              </div>
              <div style={{ alignSelf: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: inc.status_code ? 'var(--yellow)' : 'var(--red)' }}>
                  {inc.status_code || 'n/a'}
                </span>
              </div>
              <div style={{ alignSelf: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
                {inc.response_time_ms ? `${Math.round(inc.response_time_ms)}ms` : '—'}
              </div>
              <div style={{ alignSelf: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text)' }}>
                  {formatDistanceToNow(new Date(inc.checked_at), { addSuffix: true })}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                  {format(new Date(inc.checked_at), 'MMM d, HH:mm:ss')}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
