import { useState } from 'react'
import { Card, StatusBadge, Button, UptimeBar, Spinner } from '../ui'
import { monitorsApi } from '../../lib/api'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../../lib/auth'

export default function MonitorCard({ monitor, results, stats, onEdit, onDeleted, style }) {
  const [deleting, setDeleting] = useState(false)
  const { canEdit } = useAuth()

  const handleDelete = async () => {
    if (!confirm(`Delete "${monitor.name}"?`)) return
    setDeleting(true)
    await monitorsApi.remove(monitor.id)
    onDeleted()
  }

  const handleToggle = async () => {
    await monitorsApi.update(monitor.id, { is_active: !monitor.is_active })
    onDeleted() // triggers refresh
  }

  return (
    <Card style={{ padding: '22px 24px', ...style }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            {monitor.is_up !== null
              ? <StatusBadge up={monitor.is_up} size="sm" />
              : <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>PENDING</span>
            }
            {!monitor.is_active && (
              <span style={{ fontSize: 10, color: 'var(--yellow)', background: 'rgba(255,210,63,0.1)', border: '1px solid rgba(255,210,63,0.2)', borderRadius: 5, padding: '2px 7px', fontFamily: 'var(--font-mono)' }}>PAUSED</span>
            )}
          </div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{monitor.name}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {monitor.monitor_type?.toUpperCase()} - {monitor.target || monitor.url}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {canEdit && (
            <>
              <Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button>
              {deleting
                ? <Spinner size={16} />
                : <Button size="sm" variant="danger" onClick={handleDelete}>Delete</Button>
              }
            </>
          )}
        </div>
      </div>

      {/* Uptime bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, letterSpacing: '0.04em' }}>LAST 90 CHECKS</div>
        <UptimeBar results={results || []} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        {[
          { label: 'Uptime',    value: stats?.uptime_percent != null ? `${stats.uptime_percent}%` : '—', color: 'var(--green)' },
          { label: 'Avg resp',  value: stats?.avg_response_ms ? `${stats.avg_response_ms}ms` : '—', color: 'var(--blue)' },
          { label: 'Interval',  value: `${monitor.check_settings?.interval_seconds || monitor.interval_minutes * 60}s`, color: 'var(--purple)' },
          { label: 'Checked',   value: monitor.last_checked_at ? formatDistanceToNow(new Date(monitor.last_checked_at), { addSuffix: true }) : 'Never', color: 'var(--muted)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Pause/Resume */}
      {canEdit && (
        <button onClick={handleToggle} style={{
          marginTop: 14, width: '100%', padding: '7px', borderRadius: 8,
          background: 'transparent', border: '1px solid var(--border)',
          color: 'var(--muted)', fontSize: 12, cursor: 'pointer', transition: 'all 0.18s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}
        >
          {monitor.is_active ? '⏸  Pause monitoring' : '▶  Resume monitoring'}
        </button>
      )}
    </Card>
  )
}
