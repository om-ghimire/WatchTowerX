import { useState } from 'react'
import { Button, Input, Select } from '../ui'
import { monitorsApi } from '../../lib/api'

export default function MonitorModal({ monitor, onClose, onSaved }) {
  const isEdit = !!monitor
  const [form, setForm] = useState({
    name: monitor?.name || '',
    url:  monitor?.url  || 'https://',
    interval_minutes: monitor?.interval_minutes || 5,
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.name.trim())   e.name = 'Name is required'
    if (!form.url.startsWith('http')) e.url = 'Must start with http:// or https://'
    return e
  }

  const submit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true)
    try {
      if (isEdit) {
        await monitorsApi.update(monitor.id, form)
      } else {
        await monitorsApi.create({ ...form, interval_minutes: Number(form.interval_minutes) })
      }
      onSaved()
      onClose()
    } catch (err) {
      setErrors({ url: err.response?.data?.detail || 'Something went wrong' })
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
        borderRadius: 20, padding: '32px', width: 460,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        animation: 'fade-up 0.25s ease',
      }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
            {isEdit ? 'Edit Monitor' : 'Add Monitor'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {isEdit ? 'Update your monitor settings.' : 'Start monitoring a new URL.'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Input label="Name" placeholder="My Website" value={form.name}
            onChange={e => set('name', e.target.value)} error={errors.name} />
          <Input label="URL" placeholder="https://example.com" value={form.url}
            onChange={e => set('url', e.target.value)} error={errors.url} />
          <Select label="Check Interval" value={form.interval_minutes}
            onChange={e => set('interval_minutes', e.target.value)}>
            <option value={1}>Every 1 minute</option>
            <option value={3}>Every 3 minutes</option>
            <option value={5}>Every 5 minutes</option>
          </Select>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 28, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={loading}>
            {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Monitor'}
          </Button>
        </div>
      </div>
    </div>
  )
}
