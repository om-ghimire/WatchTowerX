import { useState, useCallback, useMemo } from 'react'
import { monitorsApi, resultsApi, groupsApi } from '../lib/api'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import MonitorModal from '../components/monitors/MonitorModal'
import SummaryCards from '../components/dashboard/SummaryCards'
import ResponseTimeChart from '../components/dashboard/ResponseTimeChart'
import IncidentsList from '../components/dashboard/IncidentsList'
import { Button, Panel, Spinner, UptimeBar } from '../components/ui'

const GROUP_STATUS_COLOR = {
  operational: 'var(--green)', degraded: 'var(--amber)', partial_outage: 'var(--amber)',
  major_outage: 'var(--red)', paused: 'var(--muted)', unknown: 'var(--faint)',
}
const EXPANDED_STORAGE_KEY = 'wtx_expanded_groups'
const loadExpandedMap = () => { try { return JSON.parse(localStorage.getItem(EXPANDED_STORAGE_KEY) || '{}') } catch { return {} } }
const saveExpandedMap = (map) => { try { localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(map)) } catch { /* ignore */ } }

function MonitorRow({ monitor, results, stats, onEdit, indent = 0 }) {
  const uptime = stats?.uptime_percent
  const avg    = stats?.avg_response_ms
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `${20 + indent}px 1fr 140px 80px 80px 90px`,
      alignItems: 'center', gap: 14, padding: '13px 20px',
      borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-raised)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginLeft: indent,
        background: monitor.is_up === null ? 'var(--faint)' : monitor.is_up ? 'var(--green)' : 'var(--red)',
        boxShadow: monitor.is_up ? 'var(--shadow-glow-green)' : monitor.is_up === false ? 'var(--shadow-glow-red)' : 'none',
        animation: monitor.is_up !== null ? 'pulse-dot 2.5s ease-in-out infinite' : 'none',
      }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{monitor.name}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{monitor.url}</div>
      </div>
      <div>
        <UptimeBar results={results || []} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: uptime >= 99 ? 'var(--green)' : uptime >= 90 ? 'var(--amber)' : 'var(--red)' }}>
          {uptime != null ? `${uptime}%` : '—'}
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--cyan)' }}>{avg ? `${avg}ms` : '—'}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
        {!monitor.is_active && <span style={{ fontSize: 10, color: 'var(--amber)', background: 'var(--amber-dim)', border: '1px solid rgba(255,181,69,0.25)', borderRadius: 4, padding: '2px 6px' }}>PAUSED</span>}
        <Button size="sm" variant="ghost" onClick={onEdit} style={{ padding: '4px 10px', fontSize: 12 }}>Edit</Button>
      </div>
    </div>
  )
}

function GroupRow({ group, expanded, onToggle, indent = 0 }) {
  const color = GROUP_STATUS_COLOR[group.summary?.status] || GROUP_STATUS_COLOR.unknown
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'grid', gridTemplateColumns: `${20 + indent}px 1fr 140px 80px 80px 90px`,
        alignItems: 'center', gap: 14, padding: '11px 20px', cursor: 'pointer',
        background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--faint)', marginLeft: indent, transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'none' }}>▶</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {group.group_config?.icon && <span style={{ fontSize: 13 }}>{group.group_config.icon}</span>}
        <span style={{ fontWeight: 600, fontSize: 13 }}>{group.name}</span>
        <span style={{ fontSize: 9, color, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', border: `1px solid ${color}`, borderRadius: 4, padding: '1px 5px' }}>
          {(group.summary?.status || 'unknown').replace('_', ' ')}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>{group.summary?.total ?? 0} services</div>
      <div style={{ textAlign: 'center', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--cyan)' }}>
        {group.summary?.uptime_pct != null ? `${group.summary.uptime_pct}%` : '—'}
      </div>
      <div style={{ textAlign: 'center', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--muted)' }}>
        {group.summary?.avg_latency_ms != null ? `${Math.round(group.summary.avg_latency_ms)}ms` : '—'}
      </div>
      <div />
    </div>
  )
}

export default function DashboardPage() {
  const [allMonitors, setAllMonitors] = useState([])
  const [groups, setGroups]         = useState([])
  const [allResults, setAllResults] = useState({})
  const [allStats, setAllStats]     = useState({})
  const [loading, setLoading]       = useState(true)
  const [editMonitor, setEdit]      = useState(null)
  const [showAdd, setShowAdd]       = useState(false)
  const [expandedMap, setExpandedMap] = useState(loadExpandedMap)

  const fetchAll = useCallback(async () => {
    try {
      const [mons, grps] = await Promise.all([monitorsApi.list(), groupsApi.list()])
      const leafMonitors = mons.filter(m => m.monitor_type !== 'group')
      setAllMonitors(leafMonitors)
      setGroups(grps)
      const [ra, sa] = await Promise.all([
        Promise.all(leafMonitors.map(m => resultsApi.history(m.id, 100).then(r => [m.id, r]).catch(() => [m.id, []]))),
        Promise.all(leafMonitors.map(m => resultsApi.stats(m.id).then(s => [m.id, s]).catch(() => [m.id, null]))),
      ])
      setAllResults(Object.fromEntries(ra))
      setAllStats(Object.fromEntries(sa))
    } finally { setLoading(false) }
  }, [])

  const secondsLeft = useAutoRefresh(fetchAll, 30000)
  const monitors = allMonitors
  const total = monitors.length
  const up    = monitors.filter(m => m.is_up === true).length
  const down  = monitors.filter(m => m.is_up === false).length

  const toggleExpanded = (groupId, defaultVal) => {
    setExpandedMap(prev => {
      const current = groupId in prev ? prev[groupId] : defaultVal
      const next = { ...prev, [groupId]: !current }
      saveExpandedMap(next)
      return next
    })
  }
  const isExpanded = (group) => group.id in expandedMap ? expandedMap[group.id] : (group.group_config?.expanded_by_default ?? true)

  const topLevelGroups = groups.filter(g => !g.parent_group_id)
  const childGroups = (groupId) => groups.filter(g => g.parent_group_id === groupId)
  const childMonitors = (groupId) => monitors.filter(m => m.parent_group_id === groupId)
  const ungrouped = monitors.filter(m => !m.parent_group_id)

  // Pick the monitor to feature in the telemetry chart: prefer a currently-down
  // one, else the slowest by average response time, else the first monitor.
  const featured = useMemo(() => {
    if (monitors.length === 0) return null
    const downMonitor = monitors.find(m => m.is_up === false)
    if (downMonitor) return downMonitor
    const bySpeed = [...monitors].sort((a, b) => (allStats[b.id]?.avg_response_ms || 0) - (allStats[a.id]?.avg_response_ms || 0))
    return bySpeed[0]
  }, [monitors, allStats])

  const incidentsFeed = monitors.map(m => ({ monitorId: m.id, results: allResults[m.id] || [] }))

  const renderGroupRows = (group, depth = 0) => {
    const expanded = isExpanded(group)
    const rows = [
      <GroupRow key={`g${group.id}`} group={group} expanded={expanded}
        onToggle={() => toggleExpanded(group.id, group.group_config?.expanded_by_default ?? true)} indent={depth * 16} />,
    ]
    if (expanded) {
      childGroups(group.id).forEach(cg => rows.push(...renderGroupRows(cg, depth + 1)))
      childMonitors(group.id).forEach(m => rows.push(
        <MonitorRow key={m.id} monitor={m} results={allResults[m.id]} stats={allStats[m.id]} onEdit={() => setEdit(m)} indent={(depth + 1) * 16} />
      ))
    }
    return rows
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* Top bar */}
      <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="fade-up">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Dashboard</h1>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{total} monitor{total !== 1 ? 's' : ''} watched</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Refresh in</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--green)' }}>{secondsLeft}s</div>
          </div>
          <Button variant="primary" onClick={() => setShowAdd(true)}>+ Add Monitor</Button>
        </div>
      </div>

      {/* Status banner */}
      {!loading && monitors.length > 0 && (
        <div className="fade-up-2" style={{ margin: '20px 28px 0' }}>
          <Panel accent={down === 0 ? 'green' : 'red'} style={{
            padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: down === 0 ? 'var(--green)' : 'var(--red)', boxShadow: down === 0 ? 'var(--shadow-glow-green)' : 'var(--shadow-glow-red)', animation: 'pulse-dot 2s ease-in-out infinite' }} />
            <span style={{ fontWeight: 600, fontSize: 13, color: down === 0 ? 'var(--green)' : 'var(--red)' }}>
              {down === 0 ? 'All systems operational' : `${down} monitor${down > 1 ? 's' : ''} down`}
            </span>
            {down > 0 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>— {monitors.filter(m => m.is_up === false).map(m => m.name).join(', ')}</span>}
          </Panel>
        </div>
      )}

      {/* Dominant panel + telemetry column */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><Spinner size={36} /></div>
      ) : monitors.length === 0 && groups.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 40, marginBottom: 16, color: 'var(--faint)' }}>◎</div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No monitors yet</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: 13 }}>Add your first URL to start watching uptime.</p>
          <Button variant="primary" onClick={() => setShowAdd(true)}>+ Add your first monitor</Button>
        </div>
      ) : (
        <div className="fade-up-3" style={{ margin: '16px 28px 28px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 16, alignItems: 'start' }}>
          <Panel style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 140px 80px 80px 90px', gap: 14, padding: '10px 20px', background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <div /><div>Monitor</div><div>Recent checks</div><div style={{textAlign:'center'}}>Uptime</div><div style={{textAlign:'center'}}>Avg (24h)</div><div />
            </div>
            {topLevelGroups.flatMap(g => renderGroupRows(g))}
            {ungrouped.map(m => (
              <MonitorRow key={m.id} monitor={m} results={allResults[m.id]} stats={allStats[m.id]} onEdit={() => setEdit(m)} />
            ))}
          </Panel>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SummaryCards monitors={monitors} />
            {featured && <ResponseTimeChart results={allResults[featured.id] || []} monitorName={featured.name} />}
            <IncidentsList allResults={incidentsFeed} monitors={monitors} />
          </div>
        </div>
      )}

      {showAdd     && <MonitorModal onClose={() => setShowAdd(false)} onSaved={fetchAll} />}
      {editMonitor && <MonitorModal monitor={editMonitor} onClose={() => setEdit(null)} onSaved={fetchAll} />}
    </div>
  )
}
