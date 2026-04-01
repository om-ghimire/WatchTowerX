import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Select } from '../ui'
import { alertsApi, monitorsApi } from '../../lib/api'

const defaultForm = {
  name: '',
  monitor_type: 'http',
  target: 'https://',
  port: '',
  request_config: {
    method: 'GET',
    headers_text: '',
    body: '',
    expected_status_codes_text: '200',
    keyword: '',
  },
  retry_config: {
    retry_attempts_before_down: 1,
    retry_interval_seconds: 2,
    timeout_seconds: 10,
    failure_threshold: 1,
  },
  notification_config: {
    enabled: false,
    channel_ids: [],
    trigger_on_down: true,
    trigger_on_recovery: true,
    custom_message: '',
    cooldown_seconds: 300,
  },
  check_settings: {
    interval_seconds: 60,
    locations_text: '',
  },
  advanced_config: {
    auth_type: 'none',
    auth_username: '',
    auth_password: '',
    auth_token: '',
    auth_header_name: 'Authorization',
    ignore_ssl_errors: false,
    follow_redirects: true,
    user_agent: '',
  },
  organization_config: {
    tags_text: '',
    project: '',
    description: '',
  },
}

function buildInitialForm(monitor) {
  if (!monitor) return defaultForm

  const headers = monitor.request_config?.headers || {}
  return {
    name: monitor.name || '',
    monitor_type: monitor.monitor_type || 'http',
    target: monitor.target || monitor.url || '',
    port: monitor.port || '',
    request_config: {
      method: monitor.request_config?.method || 'GET',
      headers_text: Object.entries(headers).map(([k, v]) => `${k}:${v}`).join('\n'),
      body: monitor.request_config?.body || '',
      expected_status_codes_text: (monitor.request_config?.expected_status_codes || [200]).join(','),
      keyword: monitor.request_config?.keyword || '',
    },
    retry_config: {
      retry_attempts_before_down: monitor.retry_config?.retry_attempts_before_down ?? 1,
      retry_interval_seconds: monitor.retry_config?.retry_interval_seconds ?? 2,
      timeout_seconds: monitor.retry_config?.timeout_seconds ?? 10,
      failure_threshold: monitor.retry_config?.failure_threshold ?? 1,
    },
    notification_config: {
      enabled: !!monitor.notification_config?.enabled,
      channel_ids: monitor.notification_config?.channel_ids || [],
      trigger_on_down: monitor.notification_config?.trigger_on_down ?? true,
      trigger_on_recovery: monitor.notification_config?.trigger_on_recovery ?? true,
      custom_message: monitor.notification_config?.custom_message || '',
      cooldown_seconds: monitor.notification_config?.cooldown_seconds ?? 300,
    },
    check_settings: {
      interval_seconds: monitor.check_settings?.interval_seconds ?? (monitor.interval_minutes || 1) * 60,
      locations_text: (monitor.check_settings?.locations || []).join(','),
    },
    advanced_config: {
      auth_type: monitor.advanced_config?.authentication?.type || 'none',
      auth_username: monitor.advanced_config?.authentication?.username || '',
      auth_password: monitor.advanced_config?.authentication?.password || '',
      auth_token: monitor.advanced_config?.authentication?.token || '',
      auth_header_name: monitor.advanced_config?.authentication?.header_name || 'Authorization',
      ignore_ssl_errors: !!monitor.advanced_config?.ignore_ssl_errors,
      follow_redirects: monitor.advanced_config?.follow_redirects ?? true,
      user_agent: monitor.advanced_config?.user_agent || '',
    },
    organization_config: {
      tags_text: (monitor.organization_config?.tags || []).join(','),
      project: monitor.organization_config?.project || '',
      description: monitor.organization_config?.description || '',
    },
  }
}

function parseHeaders(text) {
  const headers = {}
  text.split('\n').map(x => x.trim()).filter(Boolean).forEach(line => {
    const idx = line.indexOf(':')
    if (idx > 0) {
      const key = line.slice(0, idx).trim()
      const value = line.slice(idx + 1).trim()
      if (key) headers[key] = value
    }
  })
  return headers
}

function parseStatusCodes(text) {
  return text
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isInteger(n) && n >= 100 && n <= 599)
}

export default function MonitorModal({ monitor, onClose, onSaved }) {
  const isEdit = !!monitor
  const [form, setForm] = useState(buildInitialForm(monitor))
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [availableChannels, setAvailableChannels] = useState([])
  const [selectedChannelId, setSelectedChannelId] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setNested = (section, key, value) => {
    setForm(f => ({ ...f, [section]: { ...f[section], [key]: value } }))
  }

  useEffect(() => {
    let active = true
    alertsApi.list()
      .then(data => {
        if (active) setAvailableChannels(data || [])
      })
      .catch(() => {
        if (active) setAvailableChannels([])
      })
    return () => { active = false }
  }, [])

  const assignedChannels = useMemo(
    () => availableChannels.filter(ch => form.notification_config.channel_ids.includes(ch.id)),
    [availableChannels, form.notification_config.channel_ids]
  )

  const addNotificationChannel = () => {
    const channelId = Number(selectedChannelId)
    if (!channelId || form.notification_config.channel_ids.includes(channelId)) return
    setNested('notification_config', 'channel_ids', [...form.notification_config.channel_ids, channelId])
    setSelectedChannelId('')
  }

  const removeNotificationChannel = (channelId) => {
    setNested(
      'notification_config',
      'channel_ids',
      form.notification_config.channel_ids.filter(id => id !== channelId)
    )
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.target.trim()) e.target = 'URL / Host / IP is required'
    if ((form.monitor_type === 'http' || form.monitor_type === 'https') && !form.target.startsWith('http')) {
      e.target = 'HTTP/HTTPS targets must start with http:// or https://'
    }
    if (['tcp', 'ping'].includes(form.monitor_type) && (!form.port || Number(form.port) < 1 || Number(form.port) > 65535)) {
      e.port = 'Port is required for TCP/Ping and must be between 1-65535'
    }
    return e
  }

  const toPayload = () => ({
    name: form.name.trim(),
    monitor_type: form.monitor_type,
    target: form.target.trim(),
    port: form.port ? Number(form.port) : null,
    request_config: {
      method: form.request_config.method,
      headers: parseHeaders(form.request_config.headers_text),
      body: form.request_config.body || null,
      expected_status_codes: parseStatusCodes(form.request_config.expected_status_codes_text),
      keyword: form.request_config.keyword || null,
    },
    retry_config: {
      retry_attempts_before_down: Number(form.retry_config.retry_attempts_before_down),
      retry_interval_seconds: Number(form.retry_config.retry_interval_seconds),
      timeout_seconds: Number(form.retry_config.timeout_seconds),
      failure_threshold: Number(form.retry_config.failure_threshold),
    },
    notification_config: {
      enabled: !!form.notification_config.enabled,
      channel_ids: form.notification_config.channel_ids,
      trigger_on_down: !!form.notification_config.trigger_on_down,
      trigger_on_recovery: !!form.notification_config.trigger_on_recovery,
      custom_message: form.notification_config.custom_message || null,
      cooldown_seconds: Number(form.notification_config.cooldown_seconds),
    },
    check_settings: {
      interval_seconds: Number(form.check_settings.interval_seconds),
      locations: form.check_settings.locations_text.split(',').map(s => s.trim()).filter(Boolean),
    },
    advanced_config: {
      authentication: {
        type: form.advanced_config.auth_type,
        username: form.advanced_config.auth_username || null,
        password: form.advanced_config.auth_password || null,
        token: form.advanced_config.auth_token || null,
        header_name: form.advanced_config.auth_header_name || 'Authorization',
      },
      ignore_ssl_errors: !!form.advanced_config.ignore_ssl_errors,
      follow_redirects: !!form.advanced_config.follow_redirects,
      user_agent: form.advanced_config.user_agent || null,
    },
    organization_config: {
      tags: form.organization_config.tags_text.split(',').map(s => s.trim()).filter(Boolean),
      project: form.organization_config.project || null,
      description: form.organization_config.description || null,
    },
  })

  const submit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true)
    try {
      const payload = toPayload()
      if (isEdit) {
        await monitorsApi.update(monitor.id, payload)
      } else {
        await monitorsApi.create(payload)
      }
      onSaved()
      onClose()
    } catch (err) {
      setErrors({ target: err.response?.data?.detail || 'Something went wrong' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, backdropFilter: 'blur(4px)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 20, padding: '32px', width: 'min(960px, 94vw)', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        animation: 'fade-up 0.25s ease',
      }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
            {isEdit ? 'Edit Monitor' : 'Add Monitor'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {isEdit ? 'Update all independent monitor settings.' : 'Create a fully independent monitor configuration.'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Basic Configuration</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <Input label="Monitor Name" placeholder="Checkout API" value={form.name}
                onChange={e => set('name', e.target.value)} error={errors.name} />
              <Select label="Monitor Type" value={form.monitor_type}
                onChange={e => set('monitor_type', e.target.value)}>
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
                <option value="ping">Ping</option>
                <option value="tcp">TCP</option>
                <option value="dns">DNS</option>
              </Select>
              <Input label="URL / Host / IP" placeholder="https://example.com" value={form.target}
                onChange={e => set('target', e.target.value)} error={errors.target} />
              <Input label="Port (if applicable)" type="number" placeholder="443" value={form.port}
                onChange={e => set('port', e.target.value)} error={errors.port} />
            </div>
          </div>

          <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Request Configuration</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <Select label="HTTP Method" value={form.request_config.method} onChange={e => setNested('request_config', 'method', e.target.value)}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </Select>
              <Input label="Expected Status Codes" placeholder="200,201" value={form.request_config.expected_status_codes_text}
                onChange={e => setNested('request_config', 'expected_status_codes_text', e.target.value)} />
            </div>
            <textarea
              value={form.request_config.headers_text}
              onChange={e => setNested('request_config', 'headers_text', e.target.value)}
              placeholder={'Headers (one per line, key:value)\nAuthorization:Bearer token'}
              style={{ marginTop: 10, width: '100%', minHeight: 80, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)', padding: 10 }}
            />
            <textarea
              value={form.request_config.body}
              onChange={e => setNested('request_config', 'body', e.target.value)}
              placeholder='Request body (POST/PUT)'
              style={{ marginTop: 10, width: '100%', minHeight: 80, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)', padding: 10 }}
            />
            <Input label="Keyword Validation (optional)" placeholder="Service healthy" value={form.request_config.keyword}
              onChange={e => setNested('request_config', 'keyword', e.target.value)} />
          </div>

          <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Retry and Failure Handling</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Input label="Retry Attempts" type="number" value={form.retry_config.retry_attempts_before_down}
                onChange={e => setNested('retry_config', 'retry_attempts_before_down', e.target.value)} />
              <Input label="Retry Interval (sec)" type="number" value={form.retry_config.retry_interval_seconds}
                onChange={e => setNested('retry_config', 'retry_interval_seconds', e.target.value)} />
              <Input label="Timeout (sec)" type="number" value={form.retry_config.timeout_seconds}
                onChange={e => setNested('retry_config', 'timeout_seconds', e.target.value)} />
              <Input label="Failure Threshold" type="number" value={form.retry_config.failure_threshold}
                onChange={e => setNested('retry_config', 'failure_threshold', e.target.value)} />
            </div>
          </div>

          <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Notifications</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13 }}>
              <input type="checkbox" checked={form.notification_config.enabled}
                onChange={e => setNested('notification_config', 'enabled', e.target.checked)} />
              Enable notifications for this monitor
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'end' }}>
              <Select
                label="Notification Channel"
                value={selectedChannelId}
                onChange={e => setSelectedChannelId(e.target.value)}
              >
                <option value="">Select a channel</option>
                {availableChannels.map(ch => (
                  <option key={ch.id} value={ch.id}>{ch.name} ({ch.channel_type.toUpperCase()})</option>
                ))}
              </Select>
              <Button variant="outline" onClick={addNotificationChannel} disabled={!selectedChannelId}>+ Add Notification</Button>
              <Button variant="ghost" onClick={() => { window.location.href = '/settings' }}>Manage Channels</Button>
            </div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {assignedChannels.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>No notification channels selected.</div>
              ) : assignedChannels.map(ch => (
                <div key={ch.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 10px',
                  background: 'rgba(255,255,255,0.03)'
                }}>
                  <span style={{ fontSize: 13 }}>{ch.name} ({ch.channel_type.toUpperCase()})</span>
                  <button
                    type="button"
                    onClick={() => removeNotificationChannel(ch.id)}
                    style={{ border: 'none', background: 'transparent', color: 'var(--red)', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 10 }}>
              <Input label="Cooldown (sec)" type="number" value={form.notification_config.cooldown_seconds}
                onChange={e => setNested('notification_config', 'cooldown_seconds', e.target.value)} />
              <Input label="Custom Alert Message" placeholder='Use {monitor_name} and {target}' value={form.notification_config.custom_message}
                onChange={e => setNested('notification_config', 'custom_message', e.target.value)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13 }}>
              <input type="checkbox" checked={form.notification_config.trigger_on_down}
                onChange={e => setNested('notification_config', 'trigger_on_down', e.target.checked)} />
              Trigger on down
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 13 }}>
              <input type="checkbox" checked={form.notification_config.trigger_on_recovery}
                onChange={e => setNested('notification_config', 'trigger_on_recovery', e.target.checked)} />
              Trigger on recovery
            </label>
          </div>

          <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Check Settings</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <Input label="Check Interval (sec)" type="number" value={form.check_settings.interval_seconds}
                onChange={e => setNested('check_settings', 'interval_seconds', e.target.value)} />
              <Input label="Monitoring Locations (comma separated)" placeholder="us-east-1,eu-west-1" value={form.check_settings.locations_text}
                onChange={e => setNested('check_settings', 'locations_text', e.target.value)} />
            </div>
          </div>

          <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Advanced Options</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Select label="Auth Type" value={form.advanced_config.auth_type}
                onChange={e => setNested('advanced_config', 'auth_type', e.target.value)}>
                <option value="none">None</option>
                <option value="basic">Basic Auth</option>
                <option value="api_token">API Token</option>
              </Select>
              <Input label="Auth Username" value={form.advanced_config.auth_username}
                onChange={e => setNested('advanced_config', 'auth_username', e.target.value)} />
              <Input label="Auth Password" type="password" value={form.advanced_config.auth_password}
                onChange={e => setNested('advanced_config', 'auth_password', e.target.value)} />
              <Input label="API Token" value={form.advanced_config.auth_token}
                onChange={e => setNested('advanced_config', 'auth_token', e.target.value)} />
              <Input label="Auth Header Name" value={form.advanced_config.auth_header_name}
                onChange={e => setNested('advanced_config', 'auth_header_name', e.target.value)} />
              <Input label="Custom User-Agent" value={form.advanced_config.user_agent}
                onChange={e => setNested('advanced_config', 'user_agent', e.target.value)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13 }}>
              <input type="checkbox" checked={form.advanced_config.ignore_ssl_errors}
                onChange={e => setNested('advanced_config', 'ignore_ssl_errors', e.target.checked)} />
              Ignore SSL errors
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 13 }}>
              <input type="checkbox" checked={form.advanced_config.follow_redirects}
                onChange={e => setNested('advanced_config', 'follow_redirects', e.target.checked)} />
              Follow redirects
            </label>
          </div>

          <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Organization</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <Input label="Tags (comma separated)" placeholder="api,critical,checkout" value={form.organization_config.tags_text}
                onChange={e => setNested('organization_config', 'tags_text', e.target.value)} />
              <Input label="Project / Group" placeholder="Payments" value={form.organization_config.project}
                onChange={e => setNested('organization_config', 'project', e.target.value)} />
            </div>
            <textarea
              value={form.organization_config.description}
              onChange={e => setNested('organization_config', 'description', e.target.value)}
              placeholder='Description'
              style={{ marginTop: 10, width: '100%', minHeight: 70, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)', padding: 10 }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 28, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Monitor'}
          </Button>
        </div>
      </div>
    </div>
  )
}
