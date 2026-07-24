import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  loadAuthSession,
  loadUserPrefs,
  saveAuthSession,
  saveUserPrefs,
  type AuthSession,
  type UserPrefs,
} from './authStorage'

interface AuthContextValue {
  session: AuthSession | null
  isLoggedIn: boolean
  isGuest: boolean
  prefs: UserPrefs
  login: (session: AuthSession) => void
  enterGuest: () => void
  logout: () => void
  updatePrefs: (patch: Partial<UserPrefs>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() =>
    loadAuthSession(),
  )
  const [prefs, setPrefs] = useState<UserPrefs>(() => loadUserPrefs())

  const login = useCallback((next: AuthSession) => {
    const payload: AuthSession = {
      ...next,
      mode: 'user',
      loggedInAt: new Date().toISOString(),
    }
    saveAuthSession(payload)
    setSession(payload)
  }, [])

  const enterGuest = useCallback(() => {
    const payload: AuthSession = { mode: 'guest' }
    saveAuthSession(payload)
    setSession(payload)
  }, [])

  const logout = useCallback(() => {
    saveAuthSession(null)
    setSession(null)
  }, [])

  const updatePrefs = useCallback((patch: Partial<UserPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      saveUserPrefs(next)
      return next
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoggedIn: session?.mode === 'user',
      isGuest: session?.mode === 'guest',
      prefs,
      login,
      enterGuest,
      logout,
      updatePrefs,
    }),
    [session, prefs, login, enterGuest, logout, updatePrefs],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
