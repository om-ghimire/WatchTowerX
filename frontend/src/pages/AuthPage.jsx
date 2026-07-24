import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { authApi } from '../lib/api'
import { Button, Input } from '../components/ui'

export default function AuthPage() {
  const [mode, setMode]       = useState('login')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [name, setName]       = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [firstTimeSetup, setFirstTimeSetup] = useState(false)
  const [setupLoading, setSetupLoading] = useState(true)
  const { login, register }   = useAuth()
  const navigate              = useNavigate()

  useEffect(() => {
    let active = true

    const loadSetupStatus = async () => {
      try {
        const status = await authApi.setupStatus()
        if (!active) return
        setFirstTimeSetup(!!status.first_time_setup)
        setMode(status.first_time_setup ? 'register' : 'login')
      } catch {
        if (active) {
          setFirstTimeSetup(false)
          setMode('login')
        }
      } finally {
        if (active) setSetupLoading(false)
      }
    }

    loadSetupStatus()
    return () => { active = false }
  }, [])

  const submit = async () => {
    setError(''); setLoading(true)
    try {
      if (mode === 'login') await login(email, password)
      else                  await register(email, password, name)
      navigate('/')
    } catch (e) {
      setError(e.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', position: 'relative',
    }}>
      <div className="texture-grid" />

      <div style={{ position: 'relative', zIndex: 1, width: 420, padding: '0 16px' }} className="fade-up">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700,
            color: 'var(--green)',
          }}>
            WatchTowerX
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
            {mode === 'login' ? 'Welcome back. Sign in to continue.' : 'Create your account to start monitoring.'}
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-modal)', padding: '32px',
          boxShadow: 'var(--shadow-soft)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {mode === 'register' && (
              <Input label="Full Name" placeholder="Jane Doe" value={name}
                onChange={e => setName(e.target.value)} />
            )}
            <Input label="Email" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} />
            <Input label="Password" type="password" placeholder="••••••••"
              value={password} onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>

          {error && (
            <div style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 10,
              background: 'var(--red-dim)', color: 'var(--red)',
              fontSize: 13, border: '1px solid rgba(255,77,106,0.2)',
            }}>
              {error}
            </div>
          )}

          <Button variant="primary" onClick={submit} disabled={loading}
            style={{ width: '100%', marginTop: 24, padding: '12px' }}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>

          {!setupLoading && firstTimeSetup && (
            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--muted)' }}>
              Don't have an account?{' '}
              <button onClick={() => { setMode('register'); setError('') }}
                style={{ background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', fontWeight: 600 }}>
                Sign up
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
