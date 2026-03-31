import { Card } from '../ui'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { format } from 'date-fns'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg3)', border: '1px solid var(--border2)',
      borderRadius: 10, padding: '10px 14px', fontSize: 12,
    }}>
      <div style={{ color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontFamily: 'var(--font-mono)' }}>
          {p.name}: {p.value ? `${p.value}ms` : 'n/a'}
        </div>
      ))}
    </div>
  )
}

export default function ResponseTimeChart({ results, monitorName }) {
  const data = [...results]
    .slice(0, 50)
    .reverse()
    .map(r => ({
      time: format(new Date(r.checked_at), 'HH:mm'),
      ms: r.is_up ? Math.round(r.response_time_ms) : null,
    }))

  return (
    <Card style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Response Time</div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{monitorName}</div>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>LAST 50 CHECKS</div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#00f5a0" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#00f5a0" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="ms" name="Response" stroke="#00f5a0" strokeWidth={2} fill="url(#grad)" connectNulls={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  )
}
