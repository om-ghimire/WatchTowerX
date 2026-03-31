import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../lib/api'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('pw_token'))
  const [user, setUser]   = useState(null)

  const login = async (email, password) => {
    const data = await authApi.login(email, password)
    localStorage.setItem('pw_token', data.access_token)
    setToken(data.access_token)
  }

  const register = async (email, password, full_name) => {
    await authApi.register({ email, password, full_name })
    await login(email, password)
  }

  const logout = () => {
    localStorage.removeItem('pw_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ token, user, login, register, logout, isAuthed: !!token }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
