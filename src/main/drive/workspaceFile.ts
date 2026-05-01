import { WORKSPACE_LOCALSTORAGE_KEYS } from '../../shared/workspace-sync-keys'

export const WORKSPACE_JSON_NAME = 'workspace.json'

export type WorkspaceEntry =
  | { t: number; v: string }
  | { t: number; del: true }

export type WorkspaceFileV1 = {
  v: 1
  keys: Record<string, WorkspaceEntry>
}

export function emptyWorkspaceFile(): WorkspaceFileV1 {
  return { v: 1, keys: {} }
}

export function parseWorkspaceFile(raw: unknown): WorkspaceFileV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyWorkspaceFile()
  const o = raw as Record<string, unknown>
  if (o.v !== 1 || !o.keys || typeof o.keys !== 'object' || Array.isArray(o.keys)) {
    return emptyWorkspaceFile()
  }
  const keys: Record<string, WorkspaceEntry> = {}
  for (const [k, val] of Object.entries(o.keys as Record<string, unknown>)) {
    if (!WORKSPACE_LOCALSTORAGE_KEYS.includes(k as (typeof WORKSPACE_LOCALSTORAGE_KEYS)[number])) continue
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue
    const e = val as Record<string, unknown>
    const t = typeof e.t === 'number' ? e.t : 0
    if (e.del === true) keys[k] = { t, del: true }
    else if (typeof e.v === 'string') keys[k] = { t, v: e.v }
  }
  return { v: 1, keys }
}

/** Merge by key: keep entry with greater `t`. */
export function mergeWorkspaceFiles(a: WorkspaceFileV1, b: WorkspaceFileV1): WorkspaceFileV1 {
  const keys: Record<string, WorkspaceEntry> = { ...a.keys }
  for (const [k, eb] of Object.entries(b.keys)) {
    const ea = keys[k]
    if (!ea || eb.t >= ea.t) keys[k] = eb
  }
  return { v: 1, keys }
}

export function workspaceToLocalStorageMap(data: WorkspaceFileV1): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of WORKSPACE_LOCALSTORAGE_KEYS) {
    const e = data.keys[k]
    if (!e) continue
    if ('del' in e && e.del) continue
    if ('v' in e) out[k] = e.v
  }
  return out
}

/** True when both files carry identical entries (per tracked key), including tombstones. */
export function workspaceSyncEquals(a: WorkspaceFileV1, b: WorkspaceFileV1): boolean {
  for (const k of WORKSPACE_LOCALSTORAGE_KEYS) {
    const ea = a.keys[k]
    const eb = b.keys[k]
    if (!ea && !eb) continue
    if (!ea || !eb) return false
    if (ea.t !== eb.t) return false
    const da = 'del' in ea && ea.del
    const db = 'del' in eb && eb.del
    if (da !== db) return false
    if (da) continue
    const va = 'v' in ea ? ea.v : ''
    const vb = 'v' in eb ? eb.v : ''
    if (va !== vb) return false
  }
  return true
}

export function workspaceToHydrationPayload(data: WorkspaceFileV1): {
  set: Record<string, string>
  remove: string[]
} {
  const set: Record<string, string> = {}
  const remove: string[] = []
  for (const k of WORKSPACE_LOCALSTORAGE_KEYS) {
    const e = data.keys[k]
    if (!e) continue
    if ('del' in e && e.del) remove.push(k)
    else if ('v' in e) set[k] = e.v
  }
  return { set, remove }
}

/** Apply renderer snapshot: bump `t` only when value differs from current materialized value. */
export function applySnapshotToWorkspace(
  data: WorkspaceFileV1,
  snapshot: Record<string, string | null | undefined>
): WorkspaceFileV1 {
  const now = Date.now()
  const next: WorkspaceFileV1 = { v: 1, keys: { ...data.keys } }
  for (const k of WORKSPACE_LOCALSTORAGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(snapshot, k)) continue
    const incoming = snapshot[k]
    const prev = next.keys[k]
    const prevVal =
      prev && 'v' in prev
        ? prev.v
        : prev && 'del' in prev && prev.del
          ? null
          : undefined

    if (incoming === null || incoming === undefined) {
      if (prevVal !== null && prevVal !== undefined) {
        next.keys[k] = { t: now, del: true }
      }
      continue
    }

    if (prevVal !== incoming) {
      next.keys[k] = { t: now, v: incoming }
    }
  }
  return next
}
