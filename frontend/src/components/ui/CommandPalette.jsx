import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

const COMMANDS = [
  { id: 'dashboard', label: 'Go to Dashboard', icon: '⬡', to: '/' },
  { id: 'monitors',  label: 'Go to Monitors',  icon: '◎', to: '/monitors' },
  { id: 'incidents', label: 'Go to Incidents', icon: '⚠', to: '/incidents' },
  { id: 'settings',  label: 'Go to Settings',  icon: '⚙', to: '/settings' },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { logout } = useAuth()

  const commands = useMemo(() => [
    ...COMMANDS,
    { id: 'signout', label: 'Sign out', icon: '⎋', action: () => { logout(); navigate('/login') } },
  ], [logout, navigate])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(c => c.label.toLowerCase().includes(q))
  }, [commands, query])

  useEffect(() => {
    const onKeyDown = (e) => {
      const isToggle = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      if (isToggle) {
        e.preventDefault()
        setOpen(o => !o)
        return
      }
      if (e.key === 'Escape' && open) setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => { setActive(0) }, [query])

  const run = (cmd) => {
    if (!cmd) return
    setOpen(false)
    if (cmd.action) cmd.action()
    else navigate(cmd.to)
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '14vh', zIndex: 200, backdropFilter: 'blur(3px)',
      }}
      onClick={e => e.target === e.currentTarget && setOpen(false)}
    >
      <div style={{
        width: 'min(520px, 92vw)', background: 'var(--surface-overlay)',
        border: '1px solid var(--border2)', borderRadius: 'var(--radius-modal)',
        boxShadow: 'var(--shadow-soft)', overflow: 'hidden',
        animation: 'fade-up 0.15s ease',
      }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
            else if (e.key === 'Enter') { e.preventDefault(); run(filtered[active]) }
          }}
          placeholder="Type a command…"
          style={{
            width: '100%', background: 'transparent', border: 'none',
            borderBottom: '1px solid var(--border)', outline: 'none',
            padding: '14px 18px', fontSize: 14, color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
          }}
        />
        <div style={{ maxHeight: '40vh', overflowY: 'auto', padding: 6 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '16px 12px', fontSize: 13, color: 'var(--muted)' }}>No matching commands</div>
          ) : filtered.map((cmd, i) => (
            <div
              key={cmd.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(cmd)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 'var(--radius-btn)',
                fontSize: 13, cursor: 'pointer',
                background: i === active ? 'var(--surface-raised)' : 'transparent',
                color: i === active ? 'var(--text)' : 'var(--muted)',
              }}
            >
              <span style={{ fontSize: 14 }}>{cmd.icon}</span>
              {cmd.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
