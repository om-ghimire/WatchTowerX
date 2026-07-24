import { MetricCard } from '../ui'

export default function SummaryCards({ monitors }) {
  const total   = monitors.length
  const up      = monitors.filter(m => m.is_up === true).length
  const down    = monitors.filter(m => m.is_up === false).length
  const unknown = monitors.filter(m => m.is_up === null).length
  const upPct   = total > 0 ? Math.round((up / (total - unknown)) * 100) || 0 : 0

  const cards = [
    { label: 'Total Monitors', value: total, color: 'var(--text)' },
    { label: 'Operational',    value: up,    color: 'var(--green)', accent: 'green' },
    { label: 'Down',           value: down,  color: down > 0 ? 'var(--red)' : 'var(--text)', accent: down > 0 ? 'red' : undefined },
    { label: 'Avg Uptime',     value: `${upPct}%`, color: 'var(--cyan)' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {cards.map(({ label, value, color, accent }, i) => (
        <MetricCard key={i} label={label} value={value} color={color} accent={accent} className={`fade-up-${i + 1}`} />
      ))}
    </div>
  )
}
