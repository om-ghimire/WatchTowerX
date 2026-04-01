import { useState, useCallback } from 'react'
import { monitorsApi, resultsApi } from '../lib/api'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import MonitorModal from '../components/monitors/MonitorModal'
import { Button, Spinner, UptimeBar } from '../components/ui'

function StatPill({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
    </div>
  )
}

function MonitorRow({ monitor, results, stats, onEdit }) {
  const uptime = stats?.uptime_percent
  const avg    = stats?.avg_response_ms
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '28px 1fr 160px 90px 90px 110px',
      alignItems: 'center', gap: 16, padding: '16px 24px',
      borderBottom: '1px solid var(--border)', transition: 'background 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{
        width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
        background: monitor.is_up === null ? 'var(--faint)' : monitor.is_up ? 'var(--green)' : 'var(--red)',
        boxShadow: monitor.is_up ? '0 0 8px var(--green)' : monitor.is_up === false ? '0 0 8px var(--red)' : 'none',
        animation: monitor.is_up !== null ? 'pulse-dot 2.5s ease-in-out infinite' : 'none',
      }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{monitor.name}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{monitor.url}</div>
      </div>
      <div>
        <UptimeBar results={results || []} />
        <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 4, textAlign: 'right' }}>90 checks</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: uptime >= 99 ? 'var(--green)' : uptime >= 90 ? 'var(--yellow)' : 'var(--red)' }}>
          {uptime != null ? `${uptime}%` : '—'}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>uptime</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--blue)' }}>{avg ? `${avg}ms` : '—'}</div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>avg resp</div>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
        {!monitor.is_active && <span style={{ fontSize: 10, color: 'var(--yellow)', background: 'rgba(255,210,63,0.1)', border: '1px solid rgba(255,210,63,0.2)', borderRadius: 4, padding: '2px 6px' }}>PAUSED</span>}
        <Button size="sm" variant="ghost" onClick={onEdit} style={{ padding: '4px 10px', fontSize: 12 }}>Edit</Button>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [monitors, setMonitors]     = useState([])
  const [allResults, setAllResults] = useState({})
  const [allStats, setAllStats]     = useState({})
  const [loading, setLoading]       = useState(true)
  const [editMonitor, setEdit]      = useState(null)
  const [showAdd, setShowAdd]       = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const mons = await monitorsApi.list()
      setMonitors(mons)
      const [ra, sa] = await Promise.all([
        Promise.all(mons.map(m => resultsApi.history(m.id, 100).then(r => [m.id, r]).catch(() => [m.id, []]))),
        Promise.all(mons.map(m => resultsApi.stats(m.id).then(s => [m.id, s]).catch(() => [m.id, null]))),
      ])
      setAllResults(Object.fromEntries(ra))
      setAllStats(Object.fromEntries(sa))
    } finally { setLoading(false) }
  }, [])

  const secondsLeft = useAutoRefresh(fetchAll, 30000)
  const total = monitors.length
  const up    = monitors.filter(m => m.is_up === true).length
  const down  = monitors.filter(m => m.is_up === false).length
  const avgUp = total > 0 ? Math.round((up / Math.max(total - monitors.filter(m => m.is_up === null).length, 1)) * 100) : 0

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* Top bar */}
      <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg2)' }} className="fade-up">
        <div style={{ display: 'flex', gap: 48 }}>
          <StatPill label="Total"     value={total} color="var(--text)" />
          <StatPill label="Up"        value={up}    color="var(--green)" />
          <StatPill label="Down"      value={down}  color={down > 0 ? 'var(--red)' : 'var(--muted)'} />
          <StatPill label="Avg Uptime" value={`${avgUp}%`} color="var(--purple)" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Refresh in</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--green)' }}>{secondsLeft}s</div>
          </div>
          <Button variant="primary" onClick={() => setShowAdd(true)}>+ Add Monitor</Button>
        </div>
      </div>

      {/* Status banner */}
      {!loading && monitors.length > 0 && (
        <div className="fade-up-2" style={{
          margin: '24px 32px 0', padding: '16px 24px', borderRadius: 14,
          display: 'flex', alignItems: 'center', gap: 14,
          background: down === 0 ? 'rgba(0,245,160,0.07)' : 'rgba(255,77,106,0.07)',
          border: `1px solid ${down === 0 ? 'rgba(0,245,160,0.2)' : 'rgba(255,77,106,0.2)'}`,
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: down === 0 ? 'var(--green)' : 'var(--red)', boxShadow: `0 0 10px ${down === 0 ? 'var(--green)' : 'var(--red)'}`, animation: 'pulse-dot 2s ease-in-out infinite' }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: down === 0 ? 'var(--green)' : 'var(--red)' }}>
            {down === 0 ? 'All systems operational' : `${down} monitor${down > 1 ? 's' : ''} down`}
          </span>
          {down > 0 && <span style={{ fontSize: 13, color: 'var(--muted)' }}>— {monitors.filter(m => m.is_up === false).map(m => m.name).join(', ')}</span>}
        </div>
      )}

      {/* Monitor table */}
      <div style={{ margin: '20px 32px' }} className="fade-up-3">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><Spinner size={36} /></div>
        ) : monitors.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>◎</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>No monitors yet</h2>
            <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Add your first URL to start watching uptime.</p>
            <Button variant="primary" onClick={() => setShowAdd(true)}>+ Add your first monitor</Button>
          </div>
        ) : (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 160px 90px 90px 110px', gap: 16, padding: '12px 24px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <div /><div>Monitor</div><div>Last 90 checks</div><div style={{textAlign:'center'}}>Uptime</div><div style={{textAlign:'center'}}>Response</div><div />
            </div>
            {monitors.map(m => (
              <MonitorRow key={m.id} monitor={m} results={allResults[m.id]} stats={allStats[m.id]} onEdit={() => setEdit(m)} />
            ))}
          </div>
        )}
      </div>

      {showAdd     && <MonitorModal onClose={() => setShowAdd(false)} onSaved={fetchAll} />}
      {editMonitor && <MonitorModal monitor={editMonitor} onClose={() => setEdit(null)} onSaved={fetchAll} />}
    </div>
  )
}
