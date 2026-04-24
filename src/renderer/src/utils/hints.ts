const HINTS_KEY = 'smm-hints-enabled'
export const HINTS_CHANGE_EVENT = 'smm-hints-change'

export function isHintsEnabled(): boolean {
  try {
    const v = localStorage.getItem(HINTS_KEY)
    return v === null ? true : v === 'true'
  } catch {
    return true
  }
}

export function setHintsEnabled(on: boolean): void {
  try {
    localStorage.setItem(HINTS_KEY, String(on))
    window.dispatchEvent(new CustomEvent(HINTS_CHANGE_EVENT, { detail: on }))
  } catch { /* ignore */ }
}
