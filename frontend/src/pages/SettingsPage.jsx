import { useState, useCallback, useEffect } from 'react'
import { alertsApi, authApi, statusPagesApi, monitorsApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Button, Input, Select, Spinner, Card } from '../components/ui'

// ── Webhook channel card ───────────────────────────────
function ChannelCard({ ch, monitors, canEdit, onDeleted }) {
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
          {canEdit && <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? '…' : 'Test'}
          </Button>}
          {canEdit && (deleting ? <Spinner size={16} /> : <Button size="sm" variant="danger" onClick={handleDelete}>Delete</Button>)}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--faint)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {ch.webhook_url}
      </div>
    </Card>
  )
}

// ── Add channel form ───────────────────────────────────
function AddChannelForm({ onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: '', channel_type: 'teams', webhook_url: 'https://',
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
        monitor_id: null,
        alert_on_immediate: false,
        retry_count: 1,
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
          <option value="webhook">Webhook</option>
          <option value="custom">Custom Webhook</option>
        </Select>
        <div style={{ gridColumn: '1/-1' }}>
          <Input label="Webhook URL" placeholder="https://outlook.office.com/webhook/..." value={form.webhook_url} onChange={e => set('webhook_url', e.target.value)} error={errors.webhook_url} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={submit} disabled={loading}>{loading ? 'Saving…' : 'Add Channel'}</Button>
      </div>
    </Card>
  )
}

// ── Status page form ───────────────────────────────────
function StatusPageSection({ monitors, canEdit }) {
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
        {!showForm && canEdit && <Button variant="outline" onClick={() => setShowForm(true)}>+ New Page</Button>}
      </div>

      {showForm && canEdit && (
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
              {!canEdit && <span style={{ fontSize: 12, color: 'var(--muted)' }}>View only</span>}
              {canEdit && <Button size="sm" variant="danger" onClick={() => deletePage(p.id)}>Delete</Button>}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function TeamMembersSection({ currentUser }) {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'viewer' })

  const loadStaff = useCallback(async () => {
    try {
      setStaff(await authApi.listStaff())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStaff() }, [loadStaff])

  const createStaff = async () => {
    setSaving(true)
    try {
      await authApi.createStaff(form)
      setForm({ email: '', password: '', full_name: '', role: 'viewer' })
      setAdding(false)
      await loadStaff()
    } finally {
      setSaving(false)
    }
  }

  const updateRole = async (userId, role) => {
    await authApi.updateStaff(userId, { role })
    await loadStaff()
  }

  const removeStaff = async (userId, name) => {
    if (!confirm(`Remove ${name || 'this user'} from workspace?`)) return
    await authApi.removeStaff(userId)
    await loadStaff()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Team Access</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Invite colleagues and set their permissions.</p>
        </div>
        {!adding && <Button variant="outline" onClick={() => setAdding(true)}>+ Add Staff</Button>}
      </div>

      {adding && (
        <Card style={{ padding: 20, marginBottom: 16, border: '1px solid rgba(0,245,160,0.2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 180px', gap: 10 }}>
            <Input label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input label="Password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            <Input label="Full name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            <Select label="Role" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button variant="primary" onClick={createStaff} disabled={saving}>{saving ? 'Adding…' : 'Create Staff Account'}</Button>
          </div>
        </Card>
      )}

      {loading ? <Spinner size={24} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {staff.map(member => (
            <Card key={member.id} style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{member.full_name || member.email}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{member.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Select value={member.role} onChange={e => updateRole(member.id, e.target.value)} disabled={member.id === currentUser.id}>
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </Select>
                {member.id !== currentUser.id && member.id !== currentUser.account_owner_id && (
                  <Button size="sm" variant="danger" onClick={() => removeStaff(member.id, member.full_name || member.email)}>Remove</Button>
                )}
              </div>
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
  const { user, canEdit, canManageStaff } = useAuth()

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
    ...(canManageStaff ? [{ id: 'team', label: 'Team Access' }] : []),
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
      <div className="fade-up" style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Configure alerts, public status pages, and workspace access.
        </p>
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
                Create reusable notification channels (including Teams) and assign them per monitor.
              </p>
            </div>
            {!showForm && canEdit && <Button variant="outline" onClick={() => setShowForm(true)}>+ Add Channel</Button>}
          </div>

          {showForm && canEdit && (
            <div style={{ marginBottom: 20 }}>
              <AddChannelForm onSaved={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} />
            </div>
          )}

          {!canEdit && (
            <div style={{ marginBottom: 16, fontSize: 12, color: 'var(--muted)' }}>
              You have viewer access. Ask an editor/admin to add or change channels.
            </div>
          )}

          {channels.length === 0 && !showForm ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 14 }}>
              No alert channels yet. Add one to receive downtime notifications.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {channels.map(ch => (
                <ChannelCard key={ch.id} ch={ch} monitors={monitors} canEdit={canEdit} onDeleted={load} />
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'status' ? (
        <div className="fade-up-3">
          <StatusPageSection monitors={monitors} canEdit={canEdit} />
        </div>
      ) : (
        <div className="fade-up-3">
          <TeamMembersSection currentUser={user} />
        </div>
      )}
    </div>
  )
}
