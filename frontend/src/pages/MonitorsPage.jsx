import { useState, useCallback, useEffect } from 'react'
import { monitorsApi, resultsApi, groupsApi } from '../lib/api'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import MonitorCard from '../components/monitors/MonitorCard'
import MonitorModal from '../components/monitors/MonitorModal'
import { Button, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth'

const GROUP_STATUS_META = {
  operational:    { label: 'Operational',    color: 'var(--green)' },
  degraded:       { label: 'Degraded',       color: 'var(--amber)' },
  partial_outage: { label: 'Partial Outage', color: 'var(--amber)' },
  major_outage:   { label: 'Major Outage',   color: 'var(--red)' },
  paused:         { label: 'Paused',         color: 'var(--muted)' },
  unknown:        { label: 'No Data',        color: 'var(--faint)' },
}

const EXPANDED_STORAGE_KEY = 'wtx_expanded_groups'

function loadExpandedMap() {
  try { return JSON.parse(localStorage.getItem(EXPANDED_STORAGE_KEY) || '{}') } catch { return {} }
}
function saveExpandedMap(map) {
  try { localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(map)) } catch { /* ignore */ }
}

function GroupHeader({ group, childCount, expanded, onToggle, onDropChild, canEdit, onEdit, onDeleted, depth }) {
  const [dragOver, setDragOver] = useState(false)
  const meta = GROUP_STATUS_META[group.summary?.status] || GROUP_STATUS_META.unknown
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!confirm(`Delete group "${group.name}"? Its monitors will be ungrouped, not deleted.`)) return
    setDeleting(true)
    await groupsApi.remove(group.id)
    onDeleted()
  }

  return (
    <div
      onClick={onToggle}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); onDropChild(e) }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        marginLeft: depth * 20, cursor: 'pointer',
        background: dragOver ? 'var(--green-dim)' : 'var(--surface-raised)',
        border: `1px solid ${dragOver ? 'rgba(0,217,126,0.4)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)', transition: 'background 0.15s',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--faint)', transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'none' }}>▶</span>
      {group.group_config?.icon && <span style={{ fontSize: 14 }}>{group.group_config.icon}</span>}
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{group.name}</div>
      </div>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: meta.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {meta.label}
      </span>
      <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', minWidth: 60, textAlign: 'right' }}>{childCount} services</span>
      <span style={{ fontSize: 11, color: 'var(--cyan)', fontFamily: 'var(--font-mono)', minWidth: 70, textAlign: 'right' }}>
        {group.summary?.uptime_pct != null ? `${group.summary.uptime_pct}%` : '—'}
      </span>
      <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', minWidth: 60, textAlign: 'right' }}>
        {group.summary?.avg_latency_ms != null ? `${Math.round(group.summary.avg_latency_ms)}ms` : '—'}
      </span>
      {canEdit && (
        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => onEdit(group)}>Edit</Button>
          <Button size="sm" variant="danger" onClick={handleDelete} disabled={deleting}>{deleting ? '…' : 'Delete'}</Button>
        </div>
      )}
    </div>
  )
}

export default function MonitorsPage() {
  const [monitors, setMonitors]     = useState([])
  const [groups, setGroups]         = useState([])
  const [allResults, setAllResults] = useState([])
  const [allStats, setAllStats]     = useState({})
  const [loading, setLoading]       = useState(true)
  const [showAdd, setShowAdd]       = useState(false)
  const [editMonitor, setEdit]      = useState(null)
  const [expandedMap, setExpandedMap] = useState(loadExpandedMap)
  const { canEdit } = useAuth()

  const fetchAll = useCallback(async () => {
    try {
      const [mons, grps] = await Promise.all([monitorsApi.list(), groupsApi.list()])
      const leafMonitors = mons.filter(m => m.monitor_type !== 'group')
      setMonitors(leafMonitors)
      setGroups(grps)
      const resultsArr = await Promise.all(
        leafMonitors.map(m => resultsApi.history(m.id).then(r => ({ monitorId: m.id, results: r })).catch(() => ({ monitorId: m.id, results: [] })))
      )
      setAllResults(resultsArr)
      const statsMap = {}
      await Promise.all(
        leafMonitors.map(m => resultsApi.stats(m.id).then(s => { statsMap[m.id] = s }).catch(() => {}))
      )
      setAllStats(statsMap)
    } finally { setLoading(false) }
  }, [])

  useAutoRefresh(fetchAll, 30000)
  const getResults = id => allResults.find(r => r.monitorId === id)?.results || []

  const toggleExpanded = (groupId, defaultVal) => {
    setExpandedMap(prev => {
      const current = groupId in prev ? prev[groupId] : defaultVal
      const next = { ...prev, [groupId]: !current }
      saveExpandedMap(next)
      return next
    })
  }
  const isExpanded = (group) => group.id in expandedMap ? expandedMap[group.id] : (group.group_config?.expanded_by_default ?? true)

  const assignToGroup = async (monitorId, groupId) => {
    if (!monitorId || monitorId === groupId) return
    try { await groupsApi.addChild(groupId, monitorId) } catch { /* validation error surfaced server-side */ }
    fetchAll()
  }
  const unassign = async (monitorId) => {
    await monitorsApi.update(monitorId, { parent_group_id: null })
    fetchAll()
  }

  const handleDropOnGroup = (groupId) => (e) => {
    const id = Number(e.dataTransfer.getData('text/plain'))
    assignToGroup(id, groupId)
  }
  const handleDropOnUngrouped = (e) => {
    e.preventDefault()
    const id = Number(e.dataTransfer.getData('text/plain'))
    if (id) unassign(id)
  }

  const topLevelGroups = groups.filter(g => !g.parent_group_id)
  const childGroups = (groupId) => groups.filter(g => g.parent_group_id === groupId)
  const childMonitors = (groupId) => monitors.filter(m => m.parent_group_id === groupId)
  const ungrouped = monitors.filter(m => !m.parent_group_id)

  const renderGroup = (group, depth = 0) => {
    const expanded = isExpanded(group)
    const children = childMonitors(group.id)
    const nestedGroups = childGroups(group.id)
    return (
      <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <GroupHeader
          group={group} childCount={group.summary?.total ?? children.length} expanded={expanded}
          onToggle={() => toggleExpanded(group.id, group.group_config?.expanded_by_default ?? true)}
          onDropChild={handleDropOnGroup(group.id)} canEdit={canEdit}
          onEdit={setEdit} onDeleted={fetchAll} depth={depth}
        />
        {expanded && (
          <div style={{ marginLeft: (depth + 1) * 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {nestedGroups.map(g => renderGroup(g, depth + 1))}
            {children.length === 0 && nestedGroups.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--faint)', padding: '8px 4px' }}>
                Drag a monitor here, or assign it via Edit → Parent Group.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                {children.map(m => (
                  <div key={m.id} draggable
                    onDragStart={e => e.dataTransfer.setData('text/plain', String(m.id))}>
                    <MonitorCard monitor={m} results={getResults(m.id)} stats={allStats[m.id]}
                      onEdit={() => setEdit(m)} onDeleted={fetchAll} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const total = monitors.length + groups.length

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }} className="fade-up">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Monitors</h1>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{monitors.length} URLs · {groups.length} group{groups.length !== 1 ? 's' : ''}</div>
        </div>
        {canEdit && <Button variant="primary" onClick={() => setShowAdd(true)}>+ Add Monitor</Button>}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><Spinner size={36} /></div>
      ) : total === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 80 }} className="fade-up">
          <div style={{ fontSize: 48, marginBottom: 16 }}>◎</div>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Nothing to monitor yet</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Add your first URL and WatchTowerX will get to work.</p>
          {canEdit && <Button variant="primary" onClick={() => setShowAdd(true)}>+ Add Monitor</Button>}
        </div>
      ) : (
        <div className="fade-up-2" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {topLevelGroups.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topLevelGroups.map(g => renderGroup(g))}
            </div>
          )}

          <div>
            {topLevelGroups.length > 0 && (
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDropOnUngrouped}
                style={{ fontSize: 11, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, padding: '6px 4px' }}
              >
                Ungrouped — drag a monitor here to remove it from a group
              </div>
            )}
            {ungrouped.length === 0 ? (
              topLevelGroups.length > 0 && <div style={{ fontSize: 12, color: 'var(--faint)' }}>Everything is grouped.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                {ungrouped.map(m => (
                  <div key={m.id} draggable onDragStart={e => e.dataTransfer.setData('text/plain', String(m.id))}>
                    <MonitorCard monitor={m} results={getResults(m.id)} stats={allStats[m.id]}
                      onEdit={() => setEdit(m)} onDeleted={fetchAll} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showAdd && canEdit && <MonitorModal onClose={() => setShowAdd(false)} onSaved={fetchAll} />}
      {editMonitor && <MonitorModal monitor={editMonitor} onClose={() => setEdit(null)} onSaved={fetchAll} />}
    </div>
  )
}
