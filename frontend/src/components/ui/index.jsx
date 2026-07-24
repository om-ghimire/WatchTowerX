import { clsx } from 'clsx'

const GLOW = {
  green: 'var(--shadow-glow-green)',
  red: 'var(--shadow-glow-red)',
  amber: 'var(--shadow-glow-amber)',
  cyan: 'var(--shadow-glow-cyan)',
}

// ── Panel ─────────────────────────────────────────────
// Flat matte surface. `elevated` adds a soft shadow, `accent` adds a thin
// left border-bar in a status color instead of a glow/gradient wash.
export function Panel({ children, className, style, elevated, accent }) {
  return (
    <div className={clsx('panel', className)} style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: accent ? `2px solid var(--${accent})` : '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      boxShadow: elevated ? 'var(--shadow-soft)' : 'none',
      ...style
    }}>
      {children}
    </div>
  )
}

// ── StatusBadge ───────────────────────────────────────
export function StatusBadge({ up, size = 'md' }) {
  const sz = size === 'sm' ? 8 : 11
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: sz, height: sz, borderRadius: '50%',
        background: up ? 'var(--green)' : 'var(--red)',
        boxShadow: up ? GLOW.green : 'none',
        border: up ? 'none' : '1px solid var(--red)',
        animation: up ? 'pulse-dot 2s ease-in-out infinite' : 'none',
        flexShrink: 0,
      }} />
      <span style={{
        fontSize: size === 'sm' ? 11 : 12,
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        color: up ? 'var(--green)' : 'var(--red)',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        {up ? 'UP' : 'DOWN'}
      </span>
    </span>
  )
}

// ── MetricCard ────────────────────────────────────────
// Generic label + large mono value block, used anywhere a KPI/stat needs
// to be shown — replaces copy-pasted stat markup across pages.
export function MetricCard({ label, value, color = 'var(--text)', accent, className, style }) {
  return (
    <Panel accent={accent} className={className} style={{ padding: '16px 18px', ...style }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>
        {value}
      </div>
    </Panel>
  )
}

// ── Button ────────────────────────────────────────────
export function Button({ children, variant = 'primary', size = 'md', onClick, disabled, type = 'button', style }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 'var(--radius-btn)', fontWeight: 500, transition: 'filter 0.15s, background 0.15s',
    fontSize: size === 'sm' ? 13 : 14,
    padding: size === 'sm' ? '6px 14px' : '10px 22px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
  const variants = {
    primary: {
      background: 'var(--green)',
      color: '#090909',
      fontWeight: 700,
    },
    danger: {
      background: 'var(--red-dim)',
      color: 'var(--red)',
      border: '1px solid rgba(255,84,104,0.3)',
    },
    ghost: {
      background: 'var(--surface-raised)',
      color: 'var(--text)',
      border: '1px solid var(--border)',
    },
    outline: {
      background: 'transparent',
      color: 'var(--green)',
      border: '1px solid var(--green)',
    },
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.filter = 'brightness(1.15)')}
      onMouseLeave={e => (e.currentTarget.style.filter = '')}
    >
      {children}
    </button>
  )
}

// ── Input ─────────────────────────────────────────────
export function Input({ label, error, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</label>}
      <input {...props} style={{
        background: 'var(--surface-overlay)',
        border: `1px solid ${error ? 'var(--red)' : 'var(--border2)'}`,
        borderRadius: 'var(--radius-input)',
        padding: '10px 14px',
        color: 'var(--text)',
        fontSize: 14,
        outline: 'none',
        transition: 'border-color 0.15s',
        width: '100%',
        ...props.style,
      }}
      onFocus={e => (e.target.style.borderColor = 'var(--cyan)')}
      onBlur={e => (e.target.style.borderColor = error ? 'var(--red)' : 'var(--border2)')}
      />
      {error && <span style={{ fontSize: 12, color: 'var(--red)' }}>{error}</span>}
    </div>
  )
}

// ── Select ────────────────────────────────────────────
export function Select({ label, children, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</label>}
      <select {...props} style={{
        background: 'var(--surface-overlay)',
        border: '1px solid var(--border2)',
        borderRadius: 'var(--radius-input)',
        padding: '10px 14px',
        color: 'var(--text)',
        fontSize: 14,
        outline: 'none',
        width: '100%',
        cursor: 'pointer',
      }}>
        {children}
      </select>
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────
export function Spinner({ size = 20 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid var(--border)`,
      borderTopColor: 'var(--green)',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  )
}

// ── UptimeBar (sparkline of up/down checks) ───────────
export function UptimeBar({ results = [] }) {
  const last90 = [...results].slice(0, 90).reverse()
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: 24 }}>
      {last90.length === 0
        ? <span style={{ fontSize: 11, color: 'var(--faint)' }}>No data yet</span>
        : last90.map((r, i) => (
          <div key={i} title={`${r.is_up ? 'UP' : 'DOWN'} — ${r.response_time_ms ? r.response_time_ms + 'ms' : 'n/a'}`}
            style={{
              flex: 1, height: r.is_up ? 20 : 12, maxWidth: 6, borderRadius: 2,
              background: r.is_up ? 'var(--green)' : 'var(--red)',
              opacity: r.is_up ? 0.7 : 1,
              transition: 'height 0.2s',
            }} />
        ))
      }
    </div>
  )
}
