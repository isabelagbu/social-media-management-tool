const REMINDERS_KEY = 'smm-reminders-enabled'
export const REMINDERS_CHANGE_EVENT = 'smm-reminders-change'

export function isRemindersEnabled(): boolean {
  try {
    const v = localStorage.getItem(REMINDERS_KEY)
    return v === null ? true : v === 'true'
  } catch {
    return true
  }
}

export function setRemindersEnabled(on: boolean): void {
  try {
    localStorage.setItem(REMINDERS_KEY, String(on))
    window.dispatchEvent(new CustomEvent(REMINDERS_CHANGE_EVENT, { detail: on }))
  } catch { /* ignore */ }
}
