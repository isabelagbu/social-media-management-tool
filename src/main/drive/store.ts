import { app, BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  clearTokens,
  getConnectedEmail,
  hasManagedDriveCredentials,
  isConnected,
  readDriveConfig,
  startOAuthFlow,
  writeDriveConfig
} from './auth'
import {
  DriveError,
  NotConnectedError,
  downloadJson,
  ensureFolder,
  findFileInFolder,
  getFileMeta,
  uploadJson,
  type DriveFileMeta
} from './client'
import { WORKSPACE_LOCALSTORAGE_KEYS } from '../../shared/workspace-sync-keys'
import {
  WORKSPACE_JSON_NAME,
  applySnapshotToWorkspace,
  emptyWorkspaceFile,
  mergeWorkspaceFiles,
  parseWorkspaceFile,
  workspaceSyncEquals,
  workspaceToHydrationPayload,
  workspaceToLocalStorageMap,
  type WorkspaceFileV1
} from './workspaceFile'

const FOLDER_NAME = 'Ready Set Post'
const POSTS_FILE = 'content-store.json'
const SCRATCHPAD_FILE = 'scratchpad.json'
const LOCAL_POSTS_FILE = 'content-store.json'
const LOCAL_SCRATCHPAD_FILE = 'scratchpad.json'
const LOCAL_WORKSPACE_FILE = 'workspace.json'
const SYNC_STATE_FILE = 'drive-sync-state.json'

const PUSH_DEBOUNCE_MS = 1200
const POLL_INTERVAL_MS = 60_000

type RemoteRefs = {
  folderId: string | null
  postsFileId: string | null
  postsVersion: string | null
  postsModifiedTime: string | null
  scratchpadFileId: string | null
  scratchpadVersion: string | null
  scratchpadModifiedTime: string | null
  workspaceFileId: string | null
  workspaceVersion: string | null
  workspaceModifiedTime: string | null
}

type SyncState = {
  refs: RemoteRefs
  lastSyncedAt: number | null
  lastError: string | null
}

export type DriveSyncStatus = {
  connected: boolean
  email: string | null
  clientIdConfigured: boolean
  credentialsManaged: boolean
  appIsDev: boolean
  lastSyncedAt: number | null
  lastError: string | null
  syncing: boolean
  hasPendingChanges: boolean
}

type RawPost = Record<string, unknown> & { id?: unknown; updatedAt?: unknown }

let syncState: SyncState = {
  refs: emptyRefs(),
  lastSyncedAt: null,
  lastError: null
}
let syncing = false
let pendingPostsTimer: NodeJS.Timeout | null = null
let pendingScratchpadTimer: NodeJS.Timeout | null = null
let pendingWorkspaceTimer: NodeJS.Timeout | null = null
let pendingPostsPush = false
let pendingScratchpadPush = false
let pendingWorkspacePush = false
let pollTimer: NodeJS.Timeout | null = null
let initialized = false

function emptyRefs(): RemoteRefs {
  return {
    folderId: null,
    postsFileId: null,
    postsVersion: null,
    postsModifiedTime: null,
    scratchpadFileId: null,
    scratchpadVersion: null,
    scratchpadModifiedTime: null,
    workspaceFileId: null,
    workspaceVersion: null,
    workspaceModifiedTime: null
  }
}

function localPostsPath(): string {
  return join(app.getPath('userData'), LOCAL_POSTS_FILE)
}

function localScratchpadPath(): string {
  return join(app.getPath('userData'), LOCAL_SCRATCHPAD_FILE)
}

function localWorkspacePath(): string {
  return join(app.getPath('userData'), LOCAL_WORKSPACE_FILE)
}

function syncStatePath(): string {
  return join(app.getPath('userData'), SYNC_STATE_FILE)
}

async function ensureUserDataDir(): Promise<void> {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
}

async function loadSyncState(): Promise<void> {
  try {
    if (!existsSync(syncStatePath())) return
    const raw = await readFile(syncStatePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<SyncState>
    syncState = {
      refs: { ...emptyRefs(), ...(parsed.refs ?? {}) },
      lastSyncedAt: typeof parsed.lastSyncedAt === 'number' ? parsed.lastSyncedAt : null,
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null
    }
  } catch {
    /* ignore corrupt state */
  }
}

async function persistSyncState(): Promise<void> {
  await ensureUserDataDir()
  await writeFile(syncStatePath(), JSON.stringify(syncState, null, 2), 'utf-8')
}

export async function readLocalPosts(): Promise<RawPost[]> {
  if (!existsSync(localPostsPath())) return []
  try {
    const raw = await readFile(localPostsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as { posts?: unknown }
    return Array.isArray(parsed.posts) ? (parsed.posts as RawPost[]) : []
  } catch {
    return []
  }
}

export async function writeLocalPosts(posts: RawPost[]): Promise<void> {
  await ensureUserDataDir()
  await writeFile(localPostsPath(), JSON.stringify({ posts }, null, 2), 'utf-8')
}

export async function readLocalScratchpad(): Promise<string> {
  if (!existsSync(localScratchpadPath())) return ''
  try {
    const raw = await readFile(localScratchpadPath(), 'utf-8')
    const parsed = JSON.parse(raw) as { text?: unknown }
    return typeof parsed.text === 'string' ? parsed.text : ''
  } catch {
    return ''
  }
}

export async function writeLocalScratchpad(text: string): Promise<void> {
  await ensureUserDataDir()
  await writeFile(localScratchpadPath(), JSON.stringify({ text }, null, 2), 'utf-8')
}

async function readLocalWorkspaceFile(): Promise<WorkspaceFileV1> {
  if (!existsSync(localWorkspacePath())) return emptyWorkspaceFile()
  try {
    const raw = await readFile(localWorkspacePath(), 'utf-8')
    return parseWorkspaceFile(JSON.parse(raw) as unknown)
  } catch {
    return emptyWorkspaceFile()
  }
}

async function writeLocalWorkspaceFile(data: WorkspaceFileV1): Promise<void> {
  await ensureUserDataDir()
  await writeFile(localWorkspacePath(), JSON.stringify(data, null, 2), 'utf-8')
}

function postUpdatedAt(p: RawPost): number {
  if (typeof p.updatedAt === 'string') {
    const t = Date.parse(p.updatedAt)
    if (Number.isFinite(t)) return t
  }
  if (typeof p.createdAt === 'string') {
    const t = Date.parse(p.createdAt as string)
    if (Number.isFinite(t)) return t
  }
  return 0
}

/**
 * Merge two post lists by `id`, keeping the version with the later `updatedAt`.
 * Posts that only exist in one list are kept.
 */
export function mergePostLists(a: RawPost[], b: RawPost[]): RawPost[] {
  const byId = new Map<string, RawPost>()
  const order: string[] = []
  for (const p of a) {
    if (!p || typeof p.id !== 'string') continue
    if (!byId.has(p.id)) order.push(p.id)
    byId.set(p.id, p)
  }
  for (const p of b) {
    if (!p || typeof p.id !== 'string') continue
    const existing = byId.get(p.id)
    if (!existing) {
      order.push(p.id)
      byId.set(p.id, p)
    } else if (postUpdatedAt(p) >= postUpdatedAt(existing)) {
      byId.set(p.id, p)
    }
  }
  return order.map((id) => byId.get(id)).filter((p): p is RawPost => !!p)
}

function broadcastStatus(): void {
  const status: Partial<DriveSyncStatus> = {
    syncing,
    lastSyncedAt: syncState.lastSyncedAt,
    lastError: syncState.lastError,
    hasPendingChanges: pendingPostsPush || pendingScratchpadPush || pendingWorkspacePush
  }
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('drive:status-change', status)
  }
}

function broadcastPostsChanged(posts: RawPost[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('drive:posts-changed', { posts })
  }
}

function broadcastScratchpadChanged(text: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('drive:scratchpad-changed', { text })
  }
}

function broadcastWorkspaceChanged(payload: ReturnType<typeof workspaceToHydrationPayload>): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('drive:workspace-changed', payload)
  }
}

async function ensureFolderRef(): Promise<DriveFileMeta> {
  if (syncState.refs.folderId) {
    try {
      return await getFileMeta(syncState.refs.folderId)
    } catch (err) {
      if (err instanceof DriveError && err.status === 404) {
        syncState.refs.folderId = null
      } else {
        throw err
      }
    }
  }
  const folder = await ensureFolder(FOLDER_NAME)
  syncState.refs.folderId = folder.id
  await persistSyncState()
  return folder
}

async function ensurePostsFileRef(folderId: string): Promise<DriveFileMeta | null> {
  if (syncState.refs.postsFileId) {
    try {
      return await getFileMeta(syncState.refs.postsFileId)
    } catch (err) {
      if (err instanceof DriveError && err.status === 404) {
        syncState.refs.postsFileId = null
        syncState.refs.postsVersion = null
        syncState.refs.postsModifiedTime = null
      } else {
        throw err
      }
    }
  }
  const found = await findFileInFolder(POSTS_FILE, folderId)
  if (found) {
    syncState.refs.postsFileId = found.id
    await persistSyncState()
  }
  return found
}

async function ensureScratchpadFileRef(folderId: string): Promise<DriveFileMeta | null> {
  if (syncState.refs.scratchpadFileId) {
    try {
      return await getFileMeta(syncState.refs.scratchpadFileId)
    } catch (err) {
      if (err instanceof DriveError && err.status === 404) {
        syncState.refs.scratchpadFileId = null
        syncState.refs.scratchpadVersion = null
        syncState.refs.scratchpadModifiedTime = null
      } else {
        throw err
      }
    }
  }
  const found = await findFileInFolder(SCRATCHPAD_FILE, folderId)
  if (found) {
    syncState.refs.scratchpadFileId = found.id
    await persistSyncState()
  }
  return found
}

async function ensureWorkspaceFileRef(folderId: string): Promise<DriveFileMeta | null> {
  if (syncState.refs.workspaceFileId) {
    try {
      return await getFileMeta(syncState.refs.workspaceFileId)
    } catch (err) {
      if (err instanceof DriveError && err.status === 404) {
        syncState.refs.workspaceFileId = null
        syncState.refs.workspaceVersion = null
        syncState.refs.workspaceModifiedTime = null
      } else {
        throw err
      }
    }
  }
  const found = await findFileInFolder(WORKSPACE_JSON_NAME, folderId)
  if (found) {
    syncState.refs.workspaceFileId = found.id
    await persistSyncState()
  }
  return found
}

/**
 * Pull from Drive, merge with local, write back to local + Drive.
 * No-op (local-only) when not connected.
 */
async function pullAndMerge(): Promise<{
  postsChanged: boolean
  scratchpadChanged: boolean
  workspaceChanged: boolean
}> {
  let postsChanged = false
  let scratchpadChanged = false
  let workspaceChanged = false
  if (!(await isConnected())) return { postsChanged, scratchpadChanged, workspaceChanged }

  const folder = await ensureFolderRef()

  // Posts
  const remotePostsMeta = await ensurePostsFileRef(folder.id)
  const localPosts = await readLocalPosts()
  if (remotePostsMeta) {
    const meta = await getFileMeta(remotePostsMeta.id)
    const remoteChanged = meta.version !== syncState.refs.postsVersion
    if (remoteChanged) {
      const remote = await downloadJson<{ posts?: unknown }>(meta.id)
      const remotePosts = Array.isArray(remote.posts) ? (remote.posts as RawPost[]) : []
      const merged = mergePostLists(localPosts, remotePosts)
      await writeLocalPosts(merged)
      const sameAsRemote = JSON.stringify(merged) === JSON.stringify(remotePosts)
      if (!sameAsRemote) {
        const uploaded = await uploadJson({
          fileId: meta.id,
          name: POSTS_FILE,
          parentFolderId: folder.id,
          data: { posts: merged }
        })
        syncState.refs.postsVersion = uploaded.version ?? null
        syncState.refs.postsModifiedTime = uploaded.modifiedTime
      } else {
        syncState.refs.postsVersion = meta.version ?? null
        syncState.refs.postsModifiedTime = meta.modifiedTime
      }
      postsChanged = JSON.stringify(merged) !== JSON.stringify(localPosts)
    }
  } else {
    // First time — push local up.
    const uploaded = await uploadJson({
      fileId: null,
      name: POSTS_FILE,
      parentFolderId: folder.id,
      data: { posts: localPosts }
    })
    syncState.refs.postsFileId = uploaded.id
    syncState.refs.postsVersion = uploaded.version ?? null
    syncState.refs.postsModifiedTime = uploaded.modifiedTime
  }

  // Scratchpad — last-writer-wins via modifiedTime.
  const remoteScratchpadMeta = await ensureScratchpadFileRef(folder.id)
  const localScratch = await readLocalScratchpad()
  if (remoteScratchpadMeta) {
    const meta = await getFileMeta(remoteScratchpadMeta.id)
    const remoteChanged = meta.version !== syncState.refs.scratchpadVersion
    if (remoteChanged) {
      const remote = await downloadJson<{ text?: unknown }>(meta.id)
      const remoteText = typeof remote.text === 'string' ? remote.text : ''
      // Prefer remote if local matches our last known sync, otherwise prefer the longer/newer.
      const next = remoteText.length >= localScratch.length ? remoteText : localScratch
      if (next !== localScratch) {
        await writeLocalScratchpad(next)
        scratchpadChanged = true
      }
      if (next !== remoteText) {
        const uploaded = await uploadJson({
          fileId: meta.id,
          name: SCRATCHPAD_FILE,
          parentFolderId: folder.id,
          data: { text: next }
        })
        syncState.refs.scratchpadVersion = uploaded.version ?? null
        syncState.refs.scratchpadModifiedTime = uploaded.modifiedTime
      } else {
        syncState.refs.scratchpadVersion = meta.version ?? null
        syncState.refs.scratchpadModifiedTime = meta.modifiedTime
      }
    }
  } else {
    const uploaded = await uploadJson({
      fileId: null,
      name: SCRATCHPAD_FILE,
      parentFolderId: folder.id,
      data: { text: localScratch }
    })
    syncState.refs.scratchpadFileId = uploaded.id
    syncState.refs.scratchpadVersion = uploaded.version ?? null
    syncState.refs.scratchpadModifiedTime = uploaded.modifiedTime
  }

  // Workspace (settings, accounts mirror, notepad prefs, etc.) — per-key LWW merge.
  const remoteWorkspaceMeta = await ensureWorkspaceFileRef(folder.id)
  const localWs = await readLocalWorkspaceFile()
  if (remoteWorkspaceMeta) {
    const meta = await getFileMeta(remoteWorkspaceMeta.id)
    const remoteChanged = meta.version !== syncState.refs.workspaceVersion
    if (remoteChanged) {
      const remoteRaw = await downloadJson<unknown>(meta.id)
      const remoteWs = parseWorkspaceFile(remoteRaw)
      const merged = mergeWorkspaceFiles(localWs, remoteWs)
      await writeLocalWorkspaceFile(merged)
      const prevMap = workspaceToLocalStorageMap(localWs)
      const mergedMap = workspaceToLocalStorageMap(merged)
      workspaceChanged = JSON.stringify(prevMap) !== JSON.stringify(mergedMap)
      if (!workspaceSyncEquals(merged, remoteWs)) {
        const uploaded = await uploadJson({
          fileId: meta.id,
          name: WORKSPACE_JSON_NAME,
          parentFolderId: folder.id,
          data: merged
        })
        syncState.refs.workspaceFileId = uploaded.id
        syncState.refs.workspaceVersion = uploaded.version ?? null
        syncState.refs.workspaceModifiedTime = uploaded.modifiedTime
      } else {
        syncState.refs.workspaceVersion = meta.version ?? null
        syncState.refs.workspaceModifiedTime = meta.modifiedTime
      }
    }
  } else {
    const uploaded = await uploadJson({
      fileId: null,
      name: WORKSPACE_JSON_NAME,
      parentFolderId: folder.id,
      data: localWs
    })
    syncState.refs.workspaceFileId = uploaded.id
    syncState.refs.workspaceVersion = uploaded.version ?? null
    syncState.refs.workspaceModifiedTime = uploaded.modifiedTime
  }

  syncState.lastSyncedAt = Date.now()
  syncState.lastError = null
  await persistSyncState()
  return { postsChanged, scratchpadChanged, workspaceChanged }
}

async function pushPostsToDrive(): Promise<void> {
  if (!(await isConnected())) return
  const folder = await ensureFolderRef()
  const localPosts = await readLocalPosts()
  // Conflict guard: if remote moved ahead, pull-merge first.
  const remoteMeta = await ensurePostsFileRef(folder.id)
  let baseFileId: string | null = remoteMeta?.id ?? null
  if (remoteMeta && remoteMeta.version !== syncState.refs.postsVersion) {
    const remote = await downloadJson<{ posts?: unknown }>(remoteMeta.id)
    const remotePosts = Array.isArray(remote.posts) ? (remote.posts as RawPost[]) : []
    const merged = mergePostLists(localPosts, remotePosts)
    await writeLocalPosts(merged)
    if (JSON.stringify(merged) !== JSON.stringify(localPosts)) {
      broadcastPostsChanged(merged)
    }
    const uploaded = await uploadJson({
      fileId: baseFileId,
      name: POSTS_FILE,
      parentFolderId: folder.id,
      data: { posts: merged }
    })
    syncState.refs.postsFileId = uploaded.id
    syncState.refs.postsVersion = uploaded.version ?? null
    syncState.refs.postsModifiedTime = uploaded.modifiedTime
  } else {
    const uploaded = await uploadJson({
      fileId: baseFileId,
      name: POSTS_FILE,
      parentFolderId: folder.id,
      data: { posts: localPosts }
    })
    syncState.refs.postsFileId = uploaded.id
    syncState.refs.postsVersion = uploaded.version ?? null
    syncState.refs.postsModifiedTime = uploaded.modifiedTime
  }
  syncState.lastSyncedAt = Date.now()
  syncState.lastError = null
  await persistSyncState()
}

async function pushScratchpadToDrive(): Promise<void> {
  if (!(await isConnected())) return
  const folder = await ensureFolderRef()
  const text = await readLocalScratchpad()
  const remoteMeta = await ensureScratchpadFileRef(folder.id)
  const uploaded = await uploadJson({
    fileId: remoteMeta?.id ?? null,
    name: SCRATCHPAD_FILE,
    parentFolderId: folder.id,
    data: { text }
  })
  syncState.refs.scratchpadFileId = uploaded.id
  syncState.refs.scratchpadVersion = uploaded.version ?? null
  syncState.refs.scratchpadModifiedTime = uploaded.modifiedTime
  syncState.lastSyncedAt = Date.now()
  syncState.lastError = null
  await persistSyncState()
}

async function pushWorkspaceToDrive(): Promise<void> {
  if (!(await isConnected())) return
  const folder = await ensureFolderRef()
  let localWs = await readLocalWorkspaceFile()
  const remoteMeta = await ensureWorkspaceFileRef(folder.id)
  let baseId: string | null = remoteMeta?.id ?? null
  if (remoteMeta && remoteMeta.version !== syncState.refs.workspaceVersion) {
    const remoteRaw = await downloadJson<unknown>(remoteMeta.id)
    const remoteWs = parseWorkspaceFile(remoteRaw)
    const merged = mergeWorkspaceFiles(localWs, remoteWs)
    const prevMap = workspaceToLocalStorageMap(localWs)
    const mergedMap = workspaceToLocalStorageMap(merged)
    if (JSON.stringify(prevMap) !== JSON.stringify(mergedMap)) {
      broadcastWorkspaceChanged(workspaceToHydrationPayload(merged))
    }
    localWs = merged
    await writeLocalWorkspaceFile(localWs)
  }
  const uploaded = await uploadJson({
    fileId: baseId,
    name: WORKSPACE_JSON_NAME,
    parentFolderId: folder.id,
    data: localWs
  })
  syncState.refs.workspaceFileId = uploaded.id
  syncState.refs.workspaceVersion = uploaded.version ?? null
  syncState.refs.workspaceModifiedTime = uploaded.modifiedTime
  syncState.lastSyncedAt = Date.now()
  syncState.lastError = null
  await persistSyncState()
}

async function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  while (syncing) {
    await new Promise((r) => setTimeout(r, 80))
  }
  syncing = true
  broadcastStatus()
  try {
    return await fn()
  } finally {
    syncing = false
    broadcastStatus()
  }
}

function schedulePostsPush(): void {
  pendingPostsPush = true
  broadcastStatus()
  if (pendingPostsTimer) clearTimeout(pendingPostsTimer)
  pendingPostsTimer = setTimeout(() => {
    pendingPostsTimer = null
    void runPostsPush()
  }, PUSH_DEBOUNCE_MS)
}

function scheduleScratchpadPush(): void {
  pendingScratchpadPush = true
  broadcastStatus()
  if (pendingScratchpadTimer) clearTimeout(pendingScratchpadTimer)
  pendingScratchpadTimer = setTimeout(() => {
    pendingScratchpadTimer = null
    void runScratchpadPush()
  }, PUSH_DEBOUNCE_MS)
}

function scheduleWorkspacePush(): void {
  pendingWorkspacePush = true
  broadcastStatus()
  if (pendingWorkspaceTimer) clearTimeout(pendingWorkspaceTimer)
  pendingWorkspaceTimer = setTimeout(() => {
    pendingWorkspaceTimer = null
    void runWorkspacePush()
  }, PUSH_DEBOUNCE_MS)
}

async function runPostsPush(): Promise<void> {
  if (!(await isConnected())) {
    pendingPostsPush = false
    broadcastStatus()
    return
  }
  await withSyncLock(async () => {
    try {
      await pushPostsToDrive()
      pendingPostsPush = false
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      syncState.lastError = msg
      await persistSyncState()
    }
  })
}

async function runScratchpadPush(): Promise<void> {
  if (!(await isConnected())) {
    pendingScratchpadPush = false
    broadcastStatus()
    return
  }
  await withSyncLock(async () => {
    try {
      await pushScratchpadToDrive()
      pendingScratchpadPush = false
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      syncState.lastError = msg
      await persistSyncState()
    }
  })
}

async function runWorkspacePush(): Promise<void> {
  if (!(await isConnected())) {
    pendingWorkspacePush = false
    broadcastStatus()
    return
  }
  await withSyncLock(async () => {
    try {
      await pushWorkspaceToDrive()
      pendingWorkspacePush = false
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      syncState.lastError = msg
      await persistSyncState()
    }
  })
}

async function runPullAndMerge(): Promise<void> {
  if (!(await isConnected())) return
  await withSyncLock(async () => {
    try {
      const { postsChanged, scratchpadChanged, workspaceChanged } = await pullAndMerge()
      if (postsChanged) {
        const posts = await readLocalPosts()
        broadcastPostsChanged(posts)
      }
      if (scratchpadChanged) {
        const text = await readLocalScratchpad()
        broadcastScratchpadChanged(text)
      }
      if (workspaceChanged) {
        const ws = await readLocalWorkspaceFile()
        broadcastWorkspaceChanged(workspaceToHydrationPayload(ws))
      }
    } catch (err) {
      if (err instanceof NotConnectedError) return
      const msg = err instanceof Error ? err.message : String(err)
      syncState.lastError = msg
      await persistSyncState()
      broadcastStatus()
    }
  })
}

function startPolling(): void {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    if (syncing || pendingPostsPush || pendingScratchpadPush || pendingWorkspacePush) return
    void runPullAndMerge()
  }, POLL_INTERVAL_MS)
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

/** Call once at app start. Loads sync state, kicks off initial pull, starts polling. */
export async function initDriveStore(): Promise<void> {
  if (initialized) return
  initialized = true
  await loadSyncState()
  if (await isConnected()) {
    void runPullAndMerge()
    startPolling()
  }
}

// ── Public API used by main IPC handlers ─────────────────────────────────────

export async function getStatus(): Promise<DriveSyncStatus> {
  const [connected, email, config] = await Promise.all([
    isConnected(),
    getConnectedEmail(),
    readDriveConfig()
  ])
  return {
    connected,
    email,
    clientIdConfigured: !!config.clientId,
    credentialsManaged: hasManagedDriveCredentials(),
    appIsDev: !app.isPackaged,
    lastSyncedAt: syncState.lastSyncedAt,
    lastError: syncState.lastError,
    syncing,
    hasPendingChanges: pendingPostsPush || pendingScratchpadPush || pendingWorkspacePush
  }
}

export async function getClientId(): Promise<string> {
  const cfg = await readDriveConfig()
  return cfg.clientId
}

export async function getClientSecret(): Promise<string> {
  const cfg = await readDriveConfig()
  return cfg.clientSecret
}

export async function setClientId(clientId: string): Promise<void> {
  const cfg = await readDriveConfig()
  await writeDriveConfig({ ...cfg, clientId })
}

export async function setClientSecret(clientSecret: string): Promise<void> {
  const cfg = await readDriveConfig()
  await writeDriveConfig({ ...cfg, clientSecret })
}

export async function connect(): Promise<DriveSyncStatus> {
  await startOAuthFlow()
  syncState.refs = emptyRefs()
  syncState.lastError = null
  await persistSyncState()
  await runPullAndMerge()
  startPolling()
  return getStatus()
}

export async function disconnect(): Promise<DriveSyncStatus> {
  stopPolling()
  await clearTokens()
  syncState.refs = emptyRefs()
  syncState.lastSyncedAt = null
  syncState.lastError = null
  await persistSyncState()
  broadcastStatus()
  return getStatus()
}

export async function syncNow(): Promise<DriveSyncStatus> {
  await runPullAndMerge()
  if (pendingPostsPush) await runPostsPush()
  if (pendingScratchpadPush) await runScratchpadPush()
  if (pendingWorkspacePush) await runWorkspacePush()
  return getStatus()
}

/** Renderer-facing read for posts. Always returns local cache; pulls happen in background. */
export async function readPosts(): Promise<{ posts: RawPost[] }> {
  const posts = await readLocalPosts()
  return { posts }
}

export async function writePosts(posts: RawPost[]): Promise<void> {
  await writeLocalPosts(posts)
  schedulePostsPush()
}

export async function replacePosts(posts: RawPost[]): Promise<{ posts: RawPost[] }> {
  await writeLocalPosts(posts)
  schedulePostsPush()
  return { posts }
}

export async function readScratchpad(): Promise<string> {
  return readLocalScratchpad()
}

export async function writeScratchpad(text: string): Promise<void> {
  await writeLocalScratchpad(text)
  scheduleScratchpadPush()
}

export async function readWorkspaceHydration(): Promise<{
  set: Record<string, string>
  remove: string[]
}> {
  const ws = await readLocalWorkspaceFile()
  return workspaceToHydrationPayload(ws)
}

export async function reportWorkspaceSnapshot(snapshot: Record<string, unknown>): Promise<void> {
  const clean: Record<string, string | null> = {}
  for (const k of WORKSPACE_LOCALSTORAGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(snapshot, k)) continue
    const v = snapshot[k]
    if (v === null || v === undefined) clean[k] = null
    else if (typeof v === 'string') clean[k] = v
  }
  if (Object.keys(clean).length === 0) return
  const prev = await readLocalWorkspaceFile()
  const next = applySnapshotToWorkspace(prev, clean)
  if (JSON.stringify(next) === JSON.stringify(prev)) return
  await writeLocalWorkspaceFile(next)
  scheduleWorkspacePush()
}
