import { useState, useCallback } from 'react'
import { monitorsApi, resultsApi } from '../lib/api'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import MonitorCard from '../components/monitors/MonitorCard'
import MonitorModal from '../components/monitors/MonitorModal'
import { Button, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth'

export default function MonitorsPage() {
  const [monitors, setMonitors]     = useState([])
  const [allResults, setAllResults] = useState([])
  const [allStats, setAllStats]     = useState({})
  const [loading, setLoading]       = useState(true)
  const [showAdd, setShowAdd]       = useState(false)
  const [editMonitor, setEdit]      = useState(null)
  const { canEdit } = useAuth()

  const fetchAll = useCallback(async () => {
    try {
      const mons = await monitorsApi.list()
      setMonitors(mons)
      const resultsArr = await Promise.all(
        mons.map(m => resultsApi.history(m.id).then(r => ({ monitorId: m.id, results: r })).catch(() => ({ monitorId: m.id, results: [] })))
      )
      setAllResults(resultsArr)
      const statsMap = {}
      await Promise.all(
        mons.map(m => resultsApi.stats(m.id).then(s => { statsMap[m.id] = s }).catch(() => {}))
      )
      setAllStats(statsMap)
    } finally { setLoading(false) }
  }, [])

  useAutoRefresh(fetchAll, 30000)
  const getResults = id => allResults.find(r => r.monitorId === id)?.results || []

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }} className="fade-up">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Monitors</h1>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{monitors.length} URLs being watched</div>
        </div>
        {canEdit && <Button variant="primary" onClick={() => setShowAdd(true)}>+ Add Monitor</Button>}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><Spinner size={36} /></div>
      ) : monitors.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 80 }} className="fade-up">
          <div style={{ fontSize: 48, marginBottom: 16 }}>◎</div>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Nothing to monitor yet</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Add your first URL and WatchTowerX will get to work.</p>
          {canEdit && <Button variant="primary" onClick={() => setShowAdd(true)}>+ Add Monitor</Button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }} className="fade-up-2">
          {monitors.map(m => (
            <MonitorCard
              key={m.id} monitor={m}
              results={getResults(m.id)} stats={allStats[m.id]}
              onEdit={() => setEdit(m)} onDeleted={fetchAll}
            />
          ))}
        </div>
      )}

      {showAdd && canEdit && <MonitorModal onClose={() => setShowAdd(false)} onSaved={fetchAll} />}
      {editMonitor && <MonitorModal monitor={editMonitor} onClose={() => setEdit(null)} onSaved={fetchAll} />}
    </div>
  )
}
