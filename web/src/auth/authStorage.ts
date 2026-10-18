/** Local-only app state. The session shape remains for compatibility with older data. */

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

/** Internal local session: no account, login or personal identifier is required. */
export const DEFAULT_USER_SESSION: AuthSession = {
  mode: 'user',
  name: '本机用户',
}

export type UserPrefs = {
  diaryPush: boolean
  memorySound: boolean
  phone?: string
  wechat?: string
  deviceLabel?: string
  toyReminders: boolean
  /** granular proactive nudge channels */
  nudgeMiss: boolean
  nudgeTravel: boolean
  nudgeNight: boolean
  nudgeFrequency: 'rare' | 'normal' | 'chatty'
}

const DEFAULT_PREFS: UserPrefs = {
  diaryPush: true,
  memorySound: true,
  phone: '',
  wechat: '',
  deviceLabel: '本机',
  toyReminders: true,
  nudgeMiss: true,
  nudgeTravel: true,
  nudgeNight: true,
  nudgeFrequency: 'normal',
}

export function loadAuthSession(): AuthSession {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) {
      saveAuthSession(DEFAULT_USER_SESSION)
      return { ...DEFAULT_USER_SESSION }
    }
    const parsed = JSON.parse(raw) as AuthSession
    // Upgrade guest / empty mode to full user so create-toy etc. always work.
    if (!parsed?.mode || parsed.mode !== 'user') {
      const upgraded: AuthSession = {
        ...DEFAULT_USER_SESSION,
        ...parsed,
        mode: 'user',
        account: parsed.account || DEFAULT_USER_SESSION.account,
        accountType: parsed.accountType || DEFAULT_USER_SESSION.accountType,
        name: parsed.name || DEFAULT_USER_SESSION.name,
        loggedInAt: parsed.loggedInAt || new Date().toISOString(),
      }
      saveAuthSession(upgraded)
      return upgraded
    }
    return parsed
  } catch {
    saveAuthSession(DEFAULT_USER_SESSION)
    return { ...DEFAULT_USER_SESSION }
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
