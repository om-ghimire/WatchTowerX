import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '⬡' },
  { to: '/monitors', label: 'Monitors', icon: '◎' },
  { to: '/incidents', label: 'Incidents', icon: '⚠' },
]

export default function Sidebar() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      padding: '28px 16px',
      position: 'sticky', top: 0, height: '100vh',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 36, paddingLeft: 8 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700,
          background: 'var(--grad-green)', WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em',
        }}>
          WATCHTOWER<span style={{ color: 'var(--blue)', WebkitTextFillColor: 'var(--blue)' }}>X</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, letterSpacing: '0.06em' }}>
          UPTIME MONITOR
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {navItems.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px', borderRadius: 10,
            fontSize: 14, fontWeight: 500,
            color: isActive ? 'var(--green)' : 'var(--muted)',
            background: isActive ? 'var(--green-dim)' : 'transparent',
            border: isActive ? '1px solid rgba(0,245,160,0.15)' : '1px solid transparent',
            transition: 'all 0.18s',
            textDecoration: 'none',
          })}
            onMouseEnter={e => { if (!e.currentTarget.style.background.includes('dim')) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            onMouseLeave={e => { if (!e.currentTarget.style.background.includes('dim')) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{ fontSize: 16 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <button onClick={handleLogout} style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', borderRadius: 10,
        fontSize: 14, fontWeight: 500, color: 'var(--muted)',
        background: 'transparent', border: '1px solid transparent',
        transition: 'all 0.18s', cursor: 'pointer',
      }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'var(--red-dim)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent' }}
      >
        <span>⎋</span> Sign out
      </button>
    </aside>
  )
}
