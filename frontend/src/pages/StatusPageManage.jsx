import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { statusPagesApi, componentsApi, incidentsApi, maintenanceApi, monitorsApi } from '../lib/api'
import { Button, Input, Select, Spinner, Panel } from '../components/ui'
import { formatDistanceToNow, format } from 'date-fns'

const COMPONENT_STATUSES = [
  { value: 'operational',    label: 'Operational',    color: 'var(--green)' },
  { value: 'degraded',       label: 'Degraded',       color: 'var(--amber)' },
  { value: 'partial_outage', label: 'Partial Outage', color: 'var(--amber)' },
  { value: 'major_outage',   label: 'Major Outage',   color: 'var(--red)' },
  { value: 'maintenance',    label: 'Maintenance',    color: 'var(--cyan)' },
]
const componentColor = (status) => COMPONENT_STATUSES.find(s => s.value === status)?.color || 'var(--muted)'

const INCIDENT_STATUSES = ['investigating', 'identified', 'monitoring', 'resolved']
const SEVERITIES = [
  { value: 'minor', color: 'var(--amber)' },
  { value: 'major', color: 'var(--red)' },
  { value: 'critical', color: 'var(--red)' },
]

const MAINTENANCE_STATUSES = ['upcoming', 'in_progress', 'completed', 'cancelled']

function toLocalInputValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding: '10px 18px', background: 'none', border: 'none',
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
          color: active === t.id ? 'var(--green)' : 'var(--muted)',
          borderBottom: `2px solid ${active === t.id ? 'var(--green)' : 'transparent'}`,
          marginBottom: -1,
        }}>{t.label}</button>
      ))}
    </div>
  )
}

// ── Overview tab ─────────────────────────────────────────
function OverviewTab({ page, monitors, onSaved }) {
  const [form, setForm] = useState({ title: page.title, description: page.description || '', monitor_ids: page.monitor_ids })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleMonitor = (id) => {
    set('monitor_ids', form.monitor_ids.includes(id) ? form.monitor_ids.filter(x => x !== id) : [...form.monitor_ids, id])
  }

  const save = async () => {
    setSaving(true)
    try {
      await statusPagesApi.update(page.id, form)
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <Panel style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Input label="Page title" value={form.title} onChange={e => set('title', e.target.value)} />
        <div style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'end', paddingBottom: 10 }}>
          Public URL: <span style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>/status/{page.slug}</span>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <Input label="Description" value={form.description} onChange={e => set('description', e.target.value)} />
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monitors to show</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {monitors.map(m => (
            <button key={m.id} onClick={() => toggleMonitor(m.id)} style={{
              padding: '6px 14px', borderRadius: 'var(--radius-btn)', fontSize: 13, cursor: 'pointer',
              background: form.monitor_ids.includes(m.id) ? 'var(--green-dim)' : 'var(--surface-raised)',
              border: `1px solid ${form.monitor_ids.includes(m.id) ? 'rgba(0,217,126,0.35)' : 'var(--border)'}`,
              color: form.monitor_ids.includes(m.id) ? 'var(--green)' : 'var(--muted)',
            }}>{m.name}</button>
          ))}
        </div>
      </div>
      <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
    </Panel>
  )
}

// ── Components tab ───────────────────────────────────────
function ComponentsTab({ pageId }) {
  const [components, setComponents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', status: 'operational', display_order: 0 })

  const load = useCallback(async () => {
    try { setComponents(await componentsApi.list(pageId)) } finally { setLoading(false) }
  }, [pageId])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.name.trim()) return
    await componentsApi.create(pageId, form)
    setForm({ name: '', description: '', status: 'operational', display_order: 0 })
    setShowForm(false)
    load()
  }

  const setStatus = async (id, status) => { await componentsApi.update(pageId, id, { status }); load() }
  const remove = async (id) => { if (confirm('Delete this component?')) { await componentsApi.remove(pageId, id); load() } }

  if (loading) return <Spinner size={24} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {!showForm && <Button variant="outline" onClick={() => setShowForm(true)}>+ Add Component</Button>}
      </div>
      {showForm && (
        <Panel style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: 10, marginBottom: 12 }}>
            <Input label="Name" placeholder="API" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {COMPONENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="primary" onClick={create}>Add</Button>
          </div>
        </Panel>
      )}
      {components.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
          No components yet. Group your monitors into services (API, Website, Database…).
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {components.map(c => (
            <Panel key={c.id} style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: componentColor(c.status), flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                {c.description && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{c.description}</div>}
              </div>
              <Select value={c.status} onChange={e => setStatus(c.id, e.target.value)} style={{ width: 170 }}>
                {COMPONENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
              <Button size="sm" variant="danger" onClick={() => remove(c.id)}>Delete</Button>
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Incidents tab ────────────────────────────────────────
function IncidentUpdateForm({ pageId, incidentId, currentStatus, onDone }) {
  const remaining = INCIDENT_STATUSES.slice(INCIDENT_STATUSES.indexOf(currentStatus) + (currentStatus === 'resolved' ? 0 : 0))
  const [status, setStatus] = useState(currentStatus === 'resolved' ? 'resolved' : INCIDENT_STATUSES[Math.min(INCIDENT_STATUSES.indexOf(currentStatus) + 1, 3)])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!message.trim()) return
    setSaving(true)
    try { await incidentsApi.addUpdate(pageId, incidentId, { status, message }); setMessage(''); onDone() }
    finally { setSaving(false) }
  }

  if (currentStatus === 'resolved') return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: 8, marginTop: 12 }}>
      <Select value={status} onChange={e => setStatus(e.target.value)}>
        {INCIDENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
      </Select>
      <Input placeholder="What's happening…" value={message} onChange={e => setMessage(e.target.value)} />
      <Button variant="outline" onClick={submit} disabled={saving}>Post Update</Button>
    </div>
  )
}

function IncidentsTab({ pageId, components }) {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', severity: 'minor', affected_component_ids: [], message: '' })

  const load = useCallback(async () => {
    try { setIncidents(await incidentsApi.list(pageId)) } finally { setLoading(false) }
  }, [pageId])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.title.trim()) return
    await incidentsApi.create(pageId, form)
    setForm({ title: '', severity: 'minor', affected_component_ids: [], message: '' })
    setShowForm(false)
    load()
  }

  const remove = async (id) => { if (confirm('Delete this incident?')) { await incidentsApi.remove(pageId, id); load() } }
  const toggleComponent = (id) => {
    setForm(f => ({ ...f, affected_component_ids: f.affected_component_ids.includes(id) ? f.affected_component_ids.filter(x => x !== id) : [...f.affected_component_ids, id] }))
  }

  if (loading) return <Spinner size={24} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {!showForm && <Button variant="outline" onClick={() => setShowForm(true)}>+ Report Incident</Button>}
      </div>
      {showForm && (
        <Panel style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 12 }}>
            <Input label="Title" placeholder="Elevated error rates" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <Select label="Severity" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
              {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.value}</option>)}
            </Select>
          </div>
          {components.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase' }}>Affected components</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {components.map(c => (
                  <button key={c.id} onClick={() => toggleComponent(c.id)} style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-btn)', fontSize: 12, cursor: 'pointer',
                    background: form.affected_component_ids.includes(c.id) ? 'var(--red-dim)' : 'var(--surface-raised)',
                    border: `1px solid ${form.affected_component_ids.includes(c.id) ? 'rgba(255,84,104,0.35)' : 'var(--border)'}`,
                    color: form.affected_component_ids.includes(c.id) ? 'var(--red)' : 'var(--muted)',
                  }}>{c.name}</button>
                ))}
              </div>
            </div>
          )}
          <Input label="Initial message" placeholder="We are investigating…" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="primary" onClick={create}>Create Incident</Button>
          </div>
        </Panel>
      )}
      {incidents.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
          No incidents. All clear.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {incidents.map(inc => {
            const sevColor = SEVERITIES.find(s => s.value === inc.severity)?.color || 'var(--muted)'
            return (
              <Panel key={inc.id} accent={inc.status === 'resolved' ? 'green' : 'red'} style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{inc.title}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: sevColor, textTransform: 'uppercase' }}>{inc.severity}</span>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: inc.status === 'resolved' ? 'var(--green)' : 'var(--amber)', textTransform: 'uppercase' }}>{inc.status}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="danger" onClick={() => remove(inc.id)}>Delete</Button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 12, borderLeft: '2px solid var(--border)' }}>
                  {inc.updates.map(u => (
                    <div key={u.id} style={{ fontSize: 12 }}>
                      <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 10, marginRight: 8 }}>
                        {format(new Date(u.created_at), 'MMM d, HH:mm')}
                      </span>
                      <span style={{ color: 'var(--text)', fontWeight: 500 }}>{u.status}</span>
                      <span style={{ color: 'var(--muted)' }}> — {u.message}</span>
                    </div>
                  ))}
                </div>
                <IncidentUpdateForm pageId={pageId} incidentId={inc.id} currentStatus={inc.status} onDone={load} />
              </Panel>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Maintenance tab ──────────────────────────────────────
function MaintenanceUpdateForm({ pageId, maintenanceId, currentStatus, onDone }) {
  const [status, setStatus] = useState(currentStatus === 'upcoming' ? 'in_progress' : 'completed')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  if (['completed', 'cancelled'].includes(currentStatus)) return null

  const submit = async () => {
    if (!message.trim()) return
    setSaving(true)
    try { await maintenanceApi.addUpdate(pageId, maintenanceId, { status, message }); setMessage(''); onDone() }
    finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: 8, marginTop: 12 }}>
      <Select value={status} onChange={e => setStatus(e.target.value)}>
        {MAINTENANCE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
      </Select>
      <Input placeholder="Update…" value={message} onChange={e => setMessage(e.target.value)} />
      <Button variant="outline" onClick={submit} disabled={saving}>Post Update</Button>
    </div>
  )
}

function MaintenanceTab({ pageId, components }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const now = new Date()
  const defaultStart = new Date(now.getTime() + 60 * 60 * 1000)
  const defaultEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  const [form, setForm] = useState({
    title: '', description: '', affected_component_ids: [],
    scheduled_start: toLocalInputValue(defaultStart), scheduled_end: toLocalInputValue(defaultEnd),
  })

  const load = useCallback(async () => {
    try { setItems(await maintenanceApi.list(pageId)) } finally { setLoading(false) }
  }, [pageId])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.title.trim()) return
    await maintenanceApi.create(pageId, {
      ...form,
      scheduled_start: new Date(form.scheduled_start).toISOString(),
      scheduled_end: new Date(form.scheduled_end).toISOString(),
    })
    setShowForm(false)
    load()
  }

  const remove = async (id) => { if (confirm('Delete this maintenance window?')) { await maintenanceApi.remove(pageId, id); load() } }
  const toggleComponent = (id) => {
    setForm(f => ({ ...f, affected_component_ids: f.affected_component_ids.includes(id) ? f.affected_component_ids.filter(x => x !== id) : [...f.affected_component_ids, id] }))
  }

  if (loading) return <Spinner size={24} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {!showForm && <Button variant="outline" onClick={() => setShowForm(true)}>+ Schedule Maintenance</Button>}
      </div>
      {showForm && (
        <Panel style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 12 }}>
            <Input label="Title" placeholder="Database upgrade" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <Input label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input label="Start" type="datetime-local" value={form.scheduled_start} onChange={e => setForm(f => ({ ...f, scheduled_start: e.target.value }))} />
              <Input label="End" type="datetime-local" value={form.scheduled_end} onChange={e => setForm(f => ({ ...f, scheduled_end: e.target.value }))} />
            </div>
          </div>
          {components.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase' }}>Affected components</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {components.map(c => (
                  <button key={c.id} onClick={() => toggleComponent(c.id)} style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-btn)', fontSize: 12, cursor: 'pointer',
                    background: form.affected_component_ids.includes(c.id) ? 'var(--cyan-dim)' : 'var(--surface-raised)',
                    border: `1px solid ${form.affected_component_ids.includes(c.id) ? 'rgba(63,196,255,0.35)' : 'var(--border)'}`,
                    color: form.affected_component_ids.includes(c.id) ? 'var(--cyan)' : 'var(--muted)',
                  }}>{c.name}</button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="primary" onClick={create}>Schedule</Button>
          </div>
        </Panel>
      )}
      {items.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
          No maintenance scheduled.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(mw => (
            <Panel key={mw.id} accent={mw.status === 'completed' ? 'green' : mw.status === 'in_progress' ? 'amber' : 'cyan'} style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{mw.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    {format(new Date(mw.scheduled_start), 'MMM d, HH:mm')} → {format(new Date(mw.scheduled_end), 'MMM d, HH:mm')}
                    {' · '}<span style={{ color: 'var(--text)', textTransform: 'uppercase' }}>{mw.status}</span>
                  </div>
                </div>
                <Button size="sm" variant="danger" onClick={() => remove(mw.id)}>Delete</Button>
              </div>
              {mw.description && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{mw.description}</div>}
              {mw.updates.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 12, borderLeft: '2px solid var(--border)' }}>
                  {mw.updates.map(u => (
                    <div key={u.id} style={{ fontSize: 12 }}>
                      <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 10, marginRight: 8 }}>
                        {format(new Date(u.created_at), 'MMM d, HH:mm')}
                      </span>
                      <span style={{ color: 'var(--muted)' }}>{u.message}</span>
                    </div>
                  ))}
                </div>
              )}
              <MaintenanceUpdateForm pageId={pageId} maintenanceId={mw.id} currentStatus={mw.status} onDone={load} />
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────
export default function StatusPageManage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const pageId = Number(id)
  const [page, setPage] = useState(null)
  const [monitors, setMonitors] = useState([])
  const [components, setComponents] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  const load = useCallback(async () => {
    try {
      const [pages, mons, comps] = await Promise.all([
        statusPagesApi.list(), monitorsApi.list(), componentsApi.list(pageId),
      ])
      setPage(pages.find(p => p.id === pageId) || null)
      setMonitors(mons)
      setComponents(comps)
    } finally { setLoading(false) }
  }, [pageId])
  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ flex: 1, display: 'flex', justifyContent: 'center', paddingTop: 80 }}><Spinner size={36} /></div>
  if (!page) return (
    <div style={{ flex: 1, padding: '32px 36px' }}>
      <div style={{ color: 'var(--muted)' }}>Status page not found.</div>
      <Button variant="ghost" onClick={() => navigate('/settings')} style={{ marginTop: 16 }}>← Back to Settings</Button>
    </div>
  )

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'components', label: 'Components' },
    { id: 'incidents', label: 'Incidents' },
    { id: 'maintenance', label: 'Maintenance' },
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
      <div style={{ marginBottom: 24 }} className="fade-up">
        <button onClick={() => navigate('/settings')} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', marginBottom: 10 }}>
          ← Back to Settings
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{page.title}</h1>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Manage components, incidents, and maintenance for this status page.</div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'overview' && <OverviewTab page={page} monitors={monitors} onSaved={load} />}
      {tab === 'components' && <ComponentsTab pageId={pageId} />}
      {tab === 'incidents' && <IncidentsTab pageId={pageId} components={components} />}
      {tab === 'maintenance' && <MaintenanceTab pageId={pageId} components={components} />}
    </div>
  )
}
