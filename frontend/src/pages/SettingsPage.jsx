import { useState, useCallback, useEffect } from 'react'
import { alertsApi, statusPagesApi, monitorsApi } from '../lib/api'
import { Button, Input, Select, Spinner, Card } from '../components/ui'

// ── Webhook channel card ───────────────────────────────
function ChannelCard({ ch, monitors, onDeleted, onUpdated }) {
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [deleting, setDeleting] = useState(false)

  const handleTest = async () => {
    setTesting(true); setTestMsg('')
    try {
      await alertsApi.test(ch.id)
      setTestMsg('✓ Test alert sent!')
    } catch { setTestMsg('✗ Failed — check webhook URL') }
    finally { setTesting(false); setTimeout(() => setTestMsg(''), 3000) }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${ch.name}"?`)) return
    setDeleting(true)
    await alertsApi.remove(ch.id)
    onDeleted()
  }

  const monitorName = ch.monitor_id
    ? monitors.find(m => m.id === ch.monitor_id)?.name || `#${ch.monitor_id}`
    : 'All monitors'

  return (
    <Card style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{ch.name}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--blue)', background: 'rgba(77,159,255,0.1)', border: '1px solid rgba(77,159,255,0.2)', borderRadius: 5, padding: '2px 8px' }}>
              {ch.channel_type.toUpperCase()}
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted)', background: 'rgba(255,255,255,0.05)', borderRadius: 5, padding: '2px 8px' }}>
              {monitorName}
            </span>
            <span style={{ fontSize: 11, color: ch.alert_on_immediate ? 'var(--yellow)' : 'var(--purple)', background: ch.alert_on_immediate ? 'rgba(255,210,63,0.1)' : 'rgba(181,123,255,0.1)', borderRadius: 5, padding: '2px 8px' }}>
              {ch.alert_on_immediate ? 'Immediate' : `After ${ch.retry_count} failures`}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {testMsg && <span style={{ fontSize: 12, color: testMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{testMsg}</span>}
          <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? '…' : 'Test'}
          </Button>
          {deleting ? <Spinner size={16} /> : <Button size="sm" variant="danger" onClick={handleDelete}>Delete</Button>}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--faint)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {ch.webhook_url}
      </div>
    </Card>
  )
}

// ── Add channel form ───────────────────────────────────
function AddChannelForm({ monitors, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: '', channel_type: 'teams', webhook_url: 'https://',
    monitor_id: '', alert_on_immediate: false, retry_count: 3,
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Required'
    if (!form.webhook_url.startsWith('http')) e.webhook_url = 'Must be a valid URL'
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true)
    try {
      await alertsApi.create({
        ...form,
        monitor_id: form.monitor_id ? parseInt(form.monitor_id) : null,
        retry_count: parseInt(form.retry_count),
      })
      onSaved()
    } catch (err) {
      setErrors({ webhook_url: err.response?.data?.detail || 'Error' })
    } finally { setLoading(false) }
  }

  return (
    <Card style={{ padding: '24px', border: '1px solid rgba(0,245,160,0.2)' }}>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 20, color: 'var(--green)' }}>New Alert Channel</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Input label="Channel name" placeholder="e.g. My Teams Channel" value={form.name} onChange={e => set('name', e.target.value)} error={errors.name} />
        <Select label="Type" value={form.channel_type} onChange={e => set('channel_type', e.target.value)}>
          <option value="teams">Microsoft Teams</option>
          <option value="slack">Slack</option>
          <option value="custom">Custom Webhook</option>
        </Select>
        <div style={{ gridColumn: '1/-1' }}>
          <Input label="Webhook URL" placeholder="https://outlook.office.com/webhook/..." value={form.webhook_url} onChange={e => set('webhook_url', e.target.value)} error={errors.webhook_url} />
        </div>
        <Select label="Apply to monitor" value={form.monitor_id} onChange={e => set('monitor_id', e.target.value)}>
          <option value="">All monitors</option>
          {monitors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
        <Select label="Alert trigger" value={form.alert_on_immediate ? 'immediate' : 'retry'} onChange={e => set('alert_on_immediate', e.target.value === 'immediate')}>
          <option value="immediate">Immediately on first failure</option>
          <option value="retry">After N consecutive failures</option>
        </Select>
        {!form.alert_on_immediate && (
          <Select label="Consecutive failures before alert" value={form.retry_count} onChange={e => set('retry_count', e.target.value)}>
            {[1,2,3,5,10].map(n => <option key={n} value={n}>{n} failure{n > 1 ? 's' : ''}</option>)}
          </Select>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={submit} disabled={loading}>{loading ? 'Saving…' : 'Add Channel'}</Button>
      </div>
    </Card>
  )
}

// ── Status page form ───────────────────────────────────
function StatusPageSection({ monitors }) {
  const [pages, setPages]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ slug: '', title: 'System Status', description: '', monitor_ids: [] })
  const [errors, setErrors]     = useState({})
  const [saving, setSaving]     = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const load = async () => {
    try { setPages(await statusPagesApi.list()) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const toggleMonitor = (id) => {
    setForm(f => ({
      ...f,
      monitor_ids: f.monitor_ids.includes(id) ? f.monitor_ids.filter(x => x !== id) : [...f.monitor_ids, id]
    }))
  }

  const submit = async () => {
    const e = {}
    if (!form.slug.trim()) e.slug = 'Required'
    if (!/^[a-z0-9-]+$/.test(form.slug)) e.slug = 'Only lowercase letters, numbers, hyphens'
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    try {
      await statusPagesApi.create({ ...form, slug: form.slug.toLowerCase() })
      setShowForm(false)
      setForm({ slug: '', title: 'System Status', description: '', monitor_ids: [] })
      load()
    } catch (err) { setErrors({ slug: err.response?.data?.detail || 'Error' }) }
    finally { setSaving(false) }
  }

  const deletePage = async (id) => {
    if (!confirm('Delete this status page?')) return
    await statusPagesApi.remove(id)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Public Status Pages</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Share a public URL showing your systems' uptime.</p>
        </div>
        {!showForm && <Button variant="outline" onClick={() => setShowForm(true)}>+ New Page</Button>}
      </div>

      {showForm && (
        <Card style={{ padding: '24px', marginBottom: 16, border: '1px solid rgba(0,245,160,0.2)' }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 20, color: 'var(--green)' }}>New Status Page</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <Input label="Custom slug" placeholder="my-company" value={form.slug} onChange={e => set('slug', e.target.value.toLowerCase())} error={errors.slug} />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                URL: <span style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>WatchTowerX.com/status/{form.slug || 'your-slug'}</span>
              </div>
            </div>
            <Input label="Page title" placeholder="System Status" value={form.title} onChange={e => set('title', e.target.value)} />
            <div style={{ gridColumn: '1/-1' }}>
              <Input label="Description (optional)" placeholder="Current status of all systems" value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monitors to show</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {monitors.map(m => (
                <button key={m.id} onClick={() => toggleMonitor(m.id)} style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                  background: form.monitor_ids.includes(m.id) ? 'var(--green-dim)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${form.monitor_ids.includes(m.id) ? 'rgba(0,245,160,0.3)' : 'var(--border)'}`,
                  color: form.monitor_ids.includes(m.id) ? 'var(--green)' : 'var(--muted)',
                  transition: 'all 0.18s',
                }}>{m.name}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="primary" onClick={submit} disabled={saving}>{saving ? 'Creating…' : 'Create Page'}</Button>
          </div>
        </Card>
      )}

      {loading ? <Spinner size={24} /> : pages.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 14 }}>
          No status pages yet. Create one to share your uptime publicly.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pages.map(p => (
            <Card key={p.id} style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{p.title}</div>
                <a href={`/status/${p.slug}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                  /status/{p.slug} ↗
                </a>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {p.monitor_ids.length} monitor{p.monitor_ids.length !== 1 ? 's' : ''} · {p.is_public ? 'Public' : 'Private'}
                </div>
              </div>
              <Button size="sm" variant="danger" onClick={() => deletePage(p.id)}>Delete</Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Settings page ─────────────────────────────────
export default function SettingsPage() {
  const [channels, setChannels]   = useState([])
  const [monitors, setMonitors]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [activeTab, setActiveTab] = useState('alerts')

  const load = useCallback(async () => {
    try {
      const [chs, mons] = await Promise.all([alertsApi.list(), monitorsApi.list()])
      setChannels(chs); setMonitors(mons)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const tabs = [
    { id: 'alerts', label: 'Alert Channels' },
    { id: 'status', label: 'Status Pages' },
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
      <div className="fade-up" style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Configure alerts and public status pages.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid var(--border)', paddingBottom: 0 }} className="fade-up-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '10px 20px', background: 'none', border: 'none',
            fontSize: 14, fontWeight: 500, cursor: 'pointer',
            color: activeTab === t.id ? 'var(--green)' : 'var(--muted)',
            borderBottom: `2px solid ${activeTab === t.id ? 'var(--green)' : 'transparent'}`,
            marginBottom: -1, transition: 'all 0.18s',
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}><Spinner size={32} /></div>
      ) : activeTab === 'alerts' ? (
        <div className="fade-up-3">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Alert Channels</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                Get notified via Teams, Slack, or any webhook when a monitor goes down.
              </p>
            </div>
            {!showForm && <Button variant="outline" onClick={() => setShowForm(true)}>+ Add Channel</Button>}
          </div>

          {showForm && (
            <div style={{ marginBottom: 20 }}>
              <AddChannelForm monitors={monitors} onSaved={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} />
            </div>
          )}

          {channels.length === 0 && !showForm ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 14 }}>
              No alert channels yet. Add one to receive downtime notifications.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {channels.map(ch => (
                <ChannelCard key={ch.id} ch={ch} monitors={monitors} onDeleted={load} onUpdated={load} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="fade-up-3">
          <StatusPageSection monitors={monitors} />
        </div>
      )}
    </div>
  )
}
