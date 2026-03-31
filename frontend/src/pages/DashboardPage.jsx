import { useState, useCallback } from 'react'
import { monitorsApi, resultsApi } from '../lib/api'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import SummaryCards from '../components/dashboard/SummaryCards'
import ResponseTimeChart from '../components/dashboard/ResponseTimeChart'
import IncidentsList from '../components/dashboard/IncidentsList'
import MonitorCard from '../components/monitors/MonitorCard'
import MonitorModal from '../components/monitors/MonitorModal'
import { Button, Spinner } from '../components/ui'

export default function DashboardPage() {
  const [monitors, setMonitors]     = useState([])
  const [allResults, setAllResults] = useState([])
  const [allStats, setAllStats]     = useState({})
  const [loading, setLoading]       = useState(true)
  const [editMonitor, setEdit]      = useState(null)
  const [showAdd, setShowAdd]       = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const mons = await monitorsApi.list()
      setMonitors(mons)
      const resultsArr = await Promise.all(
        mons.map(m => resultsApi.history(m.id, 100).then(r => ({ monitorId: m.id, results: r })).catch(() => ({ monitorId: m.id, results: [] })))
      )
      setAllResults(resultsArr)
      const statsMap = {}
      await Promise.all(
        mons.map(m => resultsApi.stats(m.id).then(s => { statsMap[m.id] = s }).catch(() => {}))
      )
      setAllStats(statsMap)
    } finally {
      setLoading(false)
    }
  }, [])

  const secondsLeft = useAutoRefresh(fetchAll, 30000)

  const getResults = id => allResults.find(r => r.monitorId === id)?.results || []

  // Pick the monitor with most results for the featured chart
  const featuredId = monitors.find(m => m.is_active)?.id
  const featuredResults = featuredId ? getResults(featuredId) : []
  const featuredMonitor = monitors.find(m => m.id === featuredId)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }} className="fade-up">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Overview of all your monitors
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Countdown */}
          <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
            <div>Auto-refresh in</div>
            <div style={{ color: 'var(--green)', fontSize: 16 }}>{secondsLeft}s</div>
          </div>
          {/* Countdown bar */}
          <div style={{ width: 80, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: 'var(--green)', borderRadius: 2,
              animation: 'countdown 30s linear infinite',
            }} />
          </div>
          <Button variant="primary" onClick={() => setShowAdd(true)}>+ Add Monitor</Button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <Spinner size={36} />
        </div>
      ) : monitors.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 80 }} className="fade-up">
          <div style={{ fontSize: 48, marginBottom: 16 }}>◎</div>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>No monitors yet</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Add your first URL to start monitoring uptime.</p>
          <Button variant="primary" onClick={() => setShowAdd(true)}>+ Add your first monitor</Button>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ marginBottom: 24 }}>
            <SummaryCards monitors={monitors} />
          </div>

          {/* Chart + Incidents row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, marginBottom: 24 }} className="fade-up-2">
            {featuredResults.length > 0
              ? <ResponseTimeChart results={featuredResults} monitorName={featuredMonitor?.name} />
              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13, border: '1px solid var(--border)', borderRadius: 20 }}>
                  Waiting for first check results…
                </div>
            }
            <IncidentsList allResults={allResults} monitors={monitors} />
          </div>

          {/* Monitor cards grid */}
          <div style={{ marginBottom: 12 }} className="fade-up-3">
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>
              All Monitors
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {monitors.map(m => (
                <MonitorCard
                  key={m.id}
                  monitor={m}
                  results={getResults(m.id)}
                  stats={allStats[m.id]}
                  onEdit={() => setEdit(m)}
                  onDeleted={fetchAll}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      {showAdd && <MonitorModal onClose={() => setShowAdd(false)} onSaved={fetchAll} />}
      {editMonitor && <MonitorModal monitor={editMonitor} onClose={() => setEdit(null)} onSaved={fetchAll} />}
    </div>
  )
}
