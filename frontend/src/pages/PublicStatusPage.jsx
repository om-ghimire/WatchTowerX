import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { statusPagesApi } from '../lib/api'
import { formatDistanceToNow, format } from 'date-fns'

// ── 90-day history bar ─────────────────────────────────
function HistoryBar({ buckets = [] }) {
  const [hovered, setHovered] = useState(null)
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 2, height: 32, alignItems: 'flex-end' }}>
        {buckets.map((pct, i) => {
          const color = pct === null ? 'var(--faint)'
            : pct >= 99  ? 'var(--green)'
            : pct >= 90  ? 'var(--amber)'
            : 'var(--red)'
          const dayLabel = format(
            new Date(Date.now() - (89 - i) * 86400000),
            'MMM d'
          )
          return (
            <div key={i} style={{ flex: 1, position: 'relative' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={{
                width: '100%',
                height: pct === null ? 12 : Math.max(8, (pct / 100) * 32),
                background: color,
                borderRadius: 2,
                transition: 'opacity 0.15s',
                opacity: hovered !== null && hovered !== i ? 0.4 : 1,
              }} />
              {hovered === i && (
                <div style={{
                  position: 'absolute', bottom: 38, left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--surface-overlay)', border: '1px solid var(--border2)',
                  borderRadius: 'var(--radius-input)', padding: '6px 10px', fontSize: 11,
                  whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'none',
                  color: 'var(--text)',
                }}>
                  <div style={{ color: 'var(--muted)', marginBottom: 2 }}>{dayLabel}</div>
                  <div style={{ color, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {pct === null ? 'No data' : `${pct}% uptime`}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--faint)' }}>
        <span>90 days ago</span>
        <span>Today</span>
      </div>
    </div>
  )
}

// ── Monitor row ────────────────────────────────────────
function MonitorRow({ m }) {
  const [expanded, setExpanded] = useState(false)
  const isUp = m.is_up
  const statusColor = isUp === null ? 'var(--faint)' : isUp ? 'var(--green)' : 'var(--red)'
  const statusLabel = isUp === null ? 'PENDING' : isUp ? 'OPERATIONAL' : 'OUTAGE'

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Main row */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}
      >
        {/* Status dot */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: statusColor,
          boxShadow: isUp ? 'var(--shadow-glow-green)' : isUp === false ? 'var(--shadow-glow-red)' : 'none',
        }} />

        {/* Name + URL */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>{m.name}</div>
          <div style={{ fontSize: 12, color: 'var(--faint)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.url}</div>
        </div>

        {/* Uptime 24h */}
        <div style={{ textAlign: 'center', minWidth: 70 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: m.uptime_24h >= 99 ? 'var(--green)' : m.uptime_24h >= 90 ? 'var(--amber)' : 'var(--red)' }}>
            {m.uptime_24h != null ? `${m.uptime_24h}%` : '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 1 }}>24h uptime</div>
        </div>

        {/* Avg response */}
        <div style={{ textAlign: 'center', minWidth: 70 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--cyan)' }}>
            {m.avg_response_ms ? `${m.avg_response_ms}ms` : '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 1 }}>avg resp</div>
        </div>

        {/* Status badge */}
        <div style={{
          padding: '5px 12px', borderRadius: 'var(--radius-input)', fontSize: 11, fontWeight: 700,
          fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
          color: statusColor, background: 'var(--surface-raised)',
          border: `1px solid ${statusColor}`,
          minWidth: 100, textAlign: 'center',
        }}>
          {statusLabel}
        </div>

        {/* Expand chevron */}
        <div style={{ color: 'var(--faint)', fontSize: 12, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▼</div>
      </div>

      {/* History bar (always visible) */}
      <div style={{ padding: '0 20px 16px' }}>
        <HistoryBar buckets={m.daily_buckets} />
      </div>

      {/* Expanded: recent incidents */}
      {expanded && m.recent_incidents?.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Recent incidents
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {m.recent_incidents.map((inc, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', borderRadius: 'var(--radius-input)',
                background: 'var(--red-dim)', border: '1px solid rgba(255,84,104,0.2)',
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ color: 'var(--red)', fontSize: 12 }}>↓</span>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{inc.error || `HTTP ${inc.status_code}` || 'Unreachable'}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--faint)' }}>
                  {formatDistanceToNow(new Date(inc.checked_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {expanded && (!m.recent_incidents || m.recent_incidents.length === 0) && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 20px', fontSize: 13, color: 'var(--faint)', textAlign: 'center' }}>
          No recent incidents recorded ✓
        </div>
      )}
    </div>
  )
}

// ── Main public page ───────────────────────────────────
export default function PublicStatusPage() {
  const { slug } = useParams()
  const [data, setData]     = useState(null)
  const [error, setError]   = useState(null)
  const [loading, setLoad]  = useState(true)

  useEffect(() => {
    statusPagesApi.getPublic(slug)
      .then(r => setData(r))
      .catch(() => setError('Status page not found'))
      .finally(() => setLoad(false))
  }, [slug])

  const overall = data?.overall_status
  const overallColor = overall === 'operational' ? 'var(--green)' : overall === 'degraded' ? 'var(--red)' : 'var(--amber)'
  const overallLabel = overall === 'operational' ? 'All Systems Operational'
    : overall === 'degraded' ? 'Partial Outage Detected'
    : 'Checking Systems…'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--green)', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 40, color: 'var(--faint)' }}>◎</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Status page not found</div>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>The page <code style={{ background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: 'var(--radius-input)' }}>/status/{slug}</code> doesn't exist.</div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: 'var(--font-body)',
      position: 'relative',
    }}>
      <div className="texture-grid" />

      <div style={{ maxWidth: 840, margin: '0 auto', padding: '56px 24px 72px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div className="fade-up" style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.12em', color: 'var(--faint)', textTransform: 'uppercase', marginBottom: 14 }}>
            Status Page
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.01em' }}>
            {data.page.title}
          </h1>
          {data.page.description && (
            <p style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 460, margin: '0 auto' }}>{data.page.description}</p>
          )}
        </div>

        {/* Overall status hero */}
        <div className="fade-up-2" style={{ marginBottom: 44 }}>
          <div style={{ padding: '13px 18px', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `2px solid ${overallColor}`, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: overallColor, boxShadow: `0 0 6px ${overallColor}`,
              animation: 'pulse-dot 2s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: overallColor }}>
              {overallLabel}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 12, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
            Last updated {data.generated_at ? formatDistanceToNow(new Date(data.generated_at), { addSuffix: true }) : 'just now'}
          </div>
        </div>

        {/* Live incident banner */}
        {overall === 'degraded' && (
          <div className="fade-up-2" style={{
            marginBottom: 24, padding: '13px 18px', borderRadius: 'var(--radius-sm)',
            background: 'var(--red-dim)', border: '1px solid rgba(255,84,104,0.3)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ color: 'var(--red)', fontSize: 16 }}>⚠</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--red)', marginBottom: 2 }}>Active Incident</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {data.monitors.filter(m => m.is_up === false).map(m => m.name).join(', ')} {data.monitors.filter(m => !m.is_up).length === 1 ? 'is' : 'are'} currently unavailable. Our team is investigating.
              </div>
            </div>
          </div>
        )}

        {/* Monitor list */}
        <div className="fade-up-3" style={{ marginBottom: 44 }}>
          <div style={{ fontSize: 11, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
            {data.monitors.length} service{data.monitors.length !== 1 ? 's' : ''} monitored
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.monitors.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--faint)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                No monitors configured for this page.
              </div>
            ) : (
              data.monitors.map(m => <MonitorRow key={m.id} m={m} />)
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="fade-up-4" style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 36 }}>
          {[['var(--green)','Operational'],['var(--amber)','Degraded'],['var(--red)','Outage'],['var(--faint)','No data']].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--faint)' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
              {label}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="fade-up-4" style={{ textAlign: 'center', fontSize: 11, color: 'var(--faint)' }}>
          Powered by{' '}
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>WatchTowerX</span>
        </div>
      </div>
    </div>
  )
}
