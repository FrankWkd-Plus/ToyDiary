/**
 * Lightweight client-side auth for demo / hackathon.
 * REPLACE_WITH_BACKEND: real OTP + session tokens.
 */

export type AuthMode = 'guest' | 'user'

export interface AuthSession {
  mode: AuthMode
  /** phone or email when logged in */
  account?: string
  accountType?: 'phone' | 'email'
  /** display name */
  name?: string
  loggedInAt?: string
}

const AUTH_KEY = 'toydairy.auth.session'
const PREFS_KEY = 'toydairy.user.prefs'

export type UserPrefs = {
  diaryPush: boolean
  memorySound: boolean
  phone?: string
  wechat?: string
  deviceLabel?: string
  toyReminders: boolean
}

const DEFAULT_PREFS: UserPrefs = {
  diaryPush: true,
  memorySound: true,
  phone: '',
  wechat: '',
  deviceLabel: '本机 · Safari / Chrome',
  toyReminders: true,
}

export function loadAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthSession
  } catch {
    return null
  }
}

export function saveAuthSession(session: AuthSession | null) {
  try {
    if (!session) localStorage.removeItem(AUTH_KEY)
    else localStorage.setItem(AUTH_KEY, JSON.stringify(session))
  } catch {
    /* ignore */
  }
}

export function loadUserPrefs(): UserPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<UserPrefs>) }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function saveUserPrefs(prefs: UserPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

/** Demo OTP: always "123456" for any phone/email. */
export const DEMO_OTP = '123456'

export function isValidPhone(v: string) {
  return /^1\d{10}$/.test(v.trim())
}

export function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}
