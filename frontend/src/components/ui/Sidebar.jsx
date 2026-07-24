import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

const navItems = [
  { to: '/',          label: 'Dashboard',  icon: '⬡' },
  { to: '/monitors',  label: 'Monitors',   icon: '◎' },
  { to: '/incidents', label: 'Incidents',  icon: '⚠' },
  { to: '/settings',  label: 'Settings',   icon: '⚙' },
]

export default function Sidebar() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  return (
    <aside style={{
      width: 208, flexShrink: 0,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      padding: '24px 14px',
      position: 'sticky', top: 0, height: '100vh',
    }}>
      <div style={{ marginBottom: 32, paddingLeft: 8 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
          color: 'var(--green)', letterSpacing: '-0.01em',
        }}>
          WatchTower<span style={{ color: 'var(--cyan)' }}>X</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 3, letterSpacing: '0.08em' }}>
          MONITOR
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {navItems.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '9px 12px', borderRadius: 'var(--radius-btn)',
            fontSize: 13, fontWeight: 500,
            color: isActive ? 'var(--green)' : 'var(--muted)',
            background: isActive ? 'var(--green-dim)' : 'transparent',
            borderLeft: isActive ? '2px solid var(--green)' : '2px solid transparent',
            transition: 'background 0.15s, color 0.15s', textDecoration: 'none',
          })}
          onMouseEnter={e => { if (!e.currentTarget.style.background.includes('dim')) e.currentTarget.style.background = 'var(--surface-raised)' }}
          onMouseLeave={e => { if (!e.currentTarget.style.background.includes('dim')) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{ fontSize: 15 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <button onClick={() => { logout(); navigate('/login') }} style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '9px 12px', borderRadius: 'var(--radius-btn)',
        fontSize: 13, fontWeight: 500, color: 'var(--muted)',
        background: 'transparent', border: '1px solid transparent',
        transition: 'background 0.15s, color 0.15s', cursor: 'pointer',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'var(--red-dim)' }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent' }}
      >
        <span>⎋</span> Sign out
      </button>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 10, padding: '8px 12px', fontSize: 11, color: 'var(--faint)',
      }}>
        <span>Command palette</span>
        <span style={{ fontFamily: 'var(--font-mono)', border: '1px solid var(--border)', borderRadius: 'var(--radius-input)', padding: '1px 6px' }}>⌘K</span>
      </div>
    </aside>
  )
}
