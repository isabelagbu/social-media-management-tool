import { WORKSPACE_LOCALSTORAGE_KEYS } from '../../../shared/workspace-sync-keys'

export const WORKSPACE_SYNCED_EVENT = 'smm-workspace-synced'

const TRACKED = new Set<string>(WORKSPACE_LOCALSTORAGE_KEYS)

let applyingRemote = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null
const DEBOUNCE_MS = 1200

export function buildWorkspaceSnapshot(): Record<string, string | null> {
  const s: Record<string, string | null> = {}
  for (const k of WORKSPACE_LOCALSTORAGE_KEYS) {
    s[k] = localStorage.getItem(k)
  }
  return s
}

export function applyWorkspaceHydrationPayload(
  payload: { set: Record<string, string>; remove: string[] },
  opts?: { notify?: boolean }
): void {
  applyingRemote = true
  try {
    for (const k of payload.remove) {
      try {
        localStorage.removeItem(k)
      } catch {
        /* ignore */
      }
    }
    for (const [k, v] of Object.entries(payload.set)) {
      try {
        localStorage.setItem(k, v)
      } catch {
        /* ignore */
      }
    }
  } finally {
    applyingRemote = false
  }
  if (opts?.notify !== false) {
    window.dispatchEvent(new CustomEvent(WORKSPACE_SYNCED_EVENT))
  }
}

function flushWorkspaceSnapshot(): void {
  if (applyingRemote) return
  debounceTimer = null
  void window.api.workspaceReportSnapshot(buildWorkspaceSnapshot())
}

function scheduleReport(): void {
  if (applyingRemote) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(flushWorkspaceSnapshot, DEBOUNCE_MS)
}

export function installWorkspaceLocalStorageSync(): void {
  const proto = Storage.prototype
  const origSet = proto.setItem
  const origRemove = proto.removeItem
  proto.setItem = function (key: string, value: string) {
    origSet.call(this, key, value)
    if (TRACKED.has(key)) scheduleReport()
  }
  proto.removeItem = function (key: string) {
    origRemove.call(this, key)
    if (TRACKED.has(key)) scheduleReport()
  }
}
