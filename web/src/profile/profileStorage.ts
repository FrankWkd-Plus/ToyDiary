/** Profile display name stored on Me page */
export const PROFILE_NAME_KEY = 'toydairy.profile.name'
export const PROFILE_AVATAR_KEY = 'toydairy.profile.avatar'
export const DEFAULT_PROFILE_NAME = '今天不睡觉'

export function loadProfileName(): string {
  try {
    return localStorage.getItem(PROFILE_NAME_KEY) || DEFAULT_PROFILE_NAME
  } catch {
    return DEFAULT_PROFILE_NAME
  }
}

export function saveProfileName(name: string) {
  try {
    localStorage.setItem(PROFILE_NAME_KEY, name)
  } catch {
    /* localStorage may be unavailable */
  }
}

export function loadProfileAvatar(fallback: string): string {
  try {
    return localStorage.getItem(PROFILE_AVATAR_KEY) || fallback
  } catch {
    return fallback
  }
}

export function saveProfileAvatar(dataUrl: string) {
  try {
    localStorage.setItem(PROFILE_AVATAR_KEY, dataUrl)
  } catch {
    /* localStorage may be unavailable */
  }
}
