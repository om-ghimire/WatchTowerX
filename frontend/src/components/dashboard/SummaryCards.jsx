import { Card } from '../ui'

export default function SummaryCards({ monitors }) {
  const total   = monitors.length
  const up      = monitors.filter(m => m.is_up === true).length
  const down    = monitors.filter(m => m.is_up === false).length
  const unknown = monitors.filter(m => m.is_up === null).length
  const upPct   = total > 0 ? Math.round((up / (total - unknown)) * 100) || 0 : 0

  const cards = [
    { label: 'Total Monitors', value: total, color: 'var(--blue)',   glow: 'rgba(77,159,255,0.2)' },
    { label: 'Operational',    value: up,    color: 'var(--green)',  glow: 'rgba(0,245,160,0.2)' },
    { label: 'Down',           value: down,  color: 'var(--red)',    glow: 'rgba(255,77,106,0.2)' },
    { label: 'Avg Uptime',     value: `${upPct}%`, color: 'var(--purple)', glow: 'rgba(181,123,255,0.2)' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
      {cards.map(({ label, value, color, glow }, i) => (
        <Card key={i} className={`fade-up-${i + 1}`} style={{ padding: '22px 24px' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            {label}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 700,
            color, textShadow: `0 0 24px ${glow}`,
            lineHeight: 1,
          }}>
            {value}
          </div>
        </Card>
      ))}
    </div>
  )
}
