import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { formatDistanceToNow, format } from 'date-fns'

// ── 90-day history bar ─────────────────────────────────
function HistoryBar({ buckets = [] }) {
  const [hovered, setHovered] = useState(null)
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 2, height: 32, alignItems: 'flex-end' }}>
        {buckets.map((pct, i) => {
          const color = pct === null ? '#2a2f45'
            : pct >= 99  ? '#00f5a0'
            : pct >= 90  ? '#ffd23f'
            : '#ff4d6a'
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
                  background: '#1a2035', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: '6px 10px', fontSize: 11,
                  whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'none',
                  color: '#f0f2ff',
                }}>
                  <div style={{ color: '#7a82a8', marginBottom: 2 }}>{dayLabel}</div>
                  <div style={{ color, fontFamily: 'monospace', fontWeight: 700 }}>
                    {pct === null ? 'No data' : `${pct}% uptime`}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: '#3a4060' }}>
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
  const statusColor = isUp === null ? '#3a4060' : isUp ? '#00f5a0' : '#ff4d6a'
  const statusLabel = isUp === null ? 'PENDING' : isUp ? 'OPERATIONAL' : 'OUTAGE'

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Main row */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: '18px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}
      >
        {/* Status dot */}
        <div style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          background: statusColor,
          boxShadow: isUp ? '0 0 8px #00f5a0' : isUp === false ? '0 0 8px #ff4d6a' : 'none',
        }} />

        {/* Name + URL */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#f0f2ff', marginBottom: 2 }}>{m.name}</div>
          <div style={{ fontSize: 12, color: '#3a4060', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.url}</div>
        </div>

        {/* Uptime 24h */}
        <div style={{ textAlign: 'center', minWidth: 70 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: m.uptime_24h >= 99 ? '#00f5a0' : m.uptime_24h >= 90 ? '#ffd23f' : '#ff4d6a' }}>
            {m.uptime_24h != null ? `${m.uptime_24h}%` : '—'}
          </div>
          <div style={{ fontSize: 10, color: '#3a4060', marginTop: 1 }}>24h uptime</div>
        </div>

        {/* Avg response */}
        <div style={{ textAlign: 'center', minWidth: 70 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: '#4d9fff' }}>
            {m.avg_response_ms ? `${m.avg_response_ms}ms` : '—'}
          </div>
          <div style={{ fontSize: 10, color: '#3a4060', marginTop: 1 }}>avg resp</div>
        </div>

        {/* Status badge */}
        <div style={{
          padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
          fontFamily: 'monospace', letterSpacing: '0.05em',
          color: statusColor, background: `${statusColor}18`,
          border: `1px solid ${statusColor}30`,
          minWidth: 100, textAlign: 'center',
        }}>
          {statusLabel}
        </div>

        {/* Expand chevron */}
        <div style={{ color: '#3a4060', fontSize: 12, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▼</div>
      </div>

      {/* History bar (always visible) */}
      <div style={{ padding: '0 24px 18px' }}>
        <HistoryBar buckets={m.daily_buckets} />
      </div>

      {/* Expanded: recent incidents */}
      {expanded && m.recent_incidents?.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '16px 24px' }}>
          <div style={{ fontSize: 11, color: '#3a4060', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Recent incidents
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {m.recent_incidents.map((inc, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(255,77,106,0.07)', border: '1px solid rgba(255,77,106,0.15)',
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ color: '#ff4d6a', fontSize: 12 }}>↓</span>
                  <span style={{ fontSize: 13, color: '#f0f2ff' }}>{inc.error || `HTTP ${inc.status_code}` || 'Unreachable'}</span>
                </div>
                <span style={{ fontSize: 11, color: '#3a4060' }}>
                  {formatDistanceToNow(new Date(inc.checked_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {expanded && (!m.recent_incidents || m.recent_incidents.length === 0) && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '16px 24px', fontSize: 13, color: '#3a4060', textAlign: 'center' }}>
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
    axios.get(`/status/${slug}`)
      .then(r => setData(r.data))
      .catch(() => setError('Status page not found'))
      .finally(() => setLoad(false))
  }, [slug])

  const overall = data?.overall_status
  const overallColor = overall === 'operational' ? '#00f5a0' : overall === 'degraded' ? '#ff4d6a' : '#ffd23f'
  const overallLabel = overall === 'operational' ? 'All Systems Operational'
    : overall === 'degraded' ? 'Partial Outage Detected'
    : 'Checking Systems…'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080b14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#00f5a0', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#080b14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 48 }}>◎</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#f0f2ff' }}>Status page not found</div>
      <div style={{ fontSize: 14, color: '#7a82a8' }}>The page <code style={{ background: 'rgba(255,255,255,0.07)', padding: '2px 6px', borderRadius: 5 }}>/status/{slug}</code> doesn't exist.</div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080b14',
      color: '#f0f2ff',
      fontFamily: "'DM Sans', sans-serif",
      backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(0,245,160,0.06), transparent)',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(0.85); } }
        .fu1 { animation: fadeUp 0.4s ease both; }
        .fu2 { animation: fadeUp 0.4s 0.1s ease both; }
        .fu3 { animation: fadeUp 0.4s 0.18s ease both; }
        .fu4 { animation: fadeUp 0.4s 0.26s ease both; }
      `}</style>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '64px 24px 80px' }}>

        {/* Header */}
        <div className="fu1" style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: '0.12em', color: '#3a4060', textTransform: 'uppercase', marginBottom: 16 }}>
            Status Page
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.02em' }}>
            {data.page.title}
          </h1>
          {data.page.description && (
            <p style={{ fontSize: 15, color: '#7a82a8', maxWidth: 480, margin: '0 auto' }}>{data.page.description}</p>
          )}
        </div>

        {/* Overall status hero */}
        <div className="fu2" style={{
          textAlign: 'center', marginBottom: 52,
          padding: '32px 24px',
          borderRadius: 20,
          background: `${overallColor}08`,
          border: `1px solid ${overallColor}25`,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 14,
            padding: '14px 28px', borderRadius: 50,
            background: `${overallColor}12`, border: `1px solid ${overallColor}30`,
          }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              background: overallColor, boxShadow: `0 0 16px ${overallColor}`,
              animation: 'pulse 2s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: overallColor, letterSpacing: '-0.01em' }}>
              {overallLabel}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#3a4060', marginTop: 16, fontFamily: "'Space Mono', monospace" }}>
            Last updated {data.generated_at ? formatDistanceToNow(new Date(data.generated_at), { addSuffix: true }) : 'just now'}
          </div>
        </div>

        {/* Live incident banner */}
        {overall === 'degraded' && (
          <div className="fu2" style={{
            marginBottom: 28, padding: '14px 20px', borderRadius: 12,
            background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.3)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ color: '#ff4d6a', fontSize: 18 }}>⚠</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#ff4d6a', marginBottom: 2 }}>Active Incident</div>
              <div style={{ fontSize: 13, color: '#7a82a8' }}>
                {data.monitors.filter(m => m.is_up === false).map(m => m.name).join(', ')} {data.monitors.filter(m => !m.is_up).length === 1 ? 'is' : 'are'} currently unavailable. Our team is investigating.
              </div>
            </div>
          </div>
        )}

        {/* Monitor list */}
        <div className="fu3" style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, color: '#3a4060', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            {data.monitors.length} service{data.monitors.length !== 1 ? 's' : ''} monitored
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.monitors.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#3a4060', border: '1px dashed rgba(255,255,255,0.07)', borderRadius: 14 }}>
                No monitors configured for this page.
              </div>
            ) : (
              data.monitors.map(m => <MonitorRow key={m.id} m={m} />)
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="fu4" style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 40 }}>
          {[['#00f5a0','Operational'],['#ffd23f','Degraded'],['#ff4d6a','Outage'],['#2a2f45','No data']].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3a4060' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
              {label}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="fu4" style={{ textAlign: 'center', fontSize: 12, color: '#2a2f45' }}>
          Powered by{' '}
          <span style={{ fontFamily: "'Space Mono', monospace", color: '#3a4060' }}>WatchTowerX</span>
        </div>
      </div>
    </div>
  )
}
