import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_USER_SESSION,
  loadAuthSession,
  loadUserPrefs,
  saveAuthSession,
  saveUserPrefs,
  type AuthSession,
  type UserPrefs,
} from './authStorage'

interface AuthContextValue {
  session: AuthSession
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
  // Always start logged-in (demo): loadAuthSession seeds a default user.
  const [session, setSession] = useState<AuthSession>(() => loadAuthSession())
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

  // Guest mode disabled — keep a user session so the app never shows login.
  const enterGuest = useCallback(() => {
    const payload: AuthSession = {
      ...DEFAULT_USER_SESSION,
      loggedInAt: new Date().toISOString(),
    }
    saveAuthSession(payload)
    setSession(payload)
  }, [])

  // Demo shell has no login screen: logout re-seeds the default user session.
  const logout = useCallback(() => {
    const payload: AuthSession = {
      ...DEFAULT_USER_SESSION,
      loggedInAt: new Date().toISOString(),
    }
    saveAuthSession(payload)
    setSession(payload)
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
      isLoggedIn: session.mode === 'user',
      isGuest: false,
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
