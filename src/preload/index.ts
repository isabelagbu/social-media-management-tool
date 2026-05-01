import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

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

const api = {
  readStore: (): Promise<{ posts: unknown[] }> => ipcRenderer.invoke('store:read'),
  writeStore: (data: { posts: unknown[] }): Promise<void> =>
    ipcRenderer.invoke('store:write', data),
  replaceStoreWithDemoSeed: (): Promise<{ posts: unknown[] }> =>
    ipcRenderer.invoke('store:replaceDemo'),
  replaceStoreWithGenericDemoSeed: (): Promise<{ posts: unknown[] }> =>
    ipcRenderer.invoke('store:replaceDemoGeneric'),
  copyText: (text: string): Promise<boolean> => ipcRenderer.invoke('clipboard:write', text),
  readNotes: (): Promise<string> => ipcRenderer.invoke('notes:read'),
  writeNotes: (text: string): Promise<void> => ipcRenderer.invoke('notes:write', text),
  setTheme: (source: 'light' | 'dark' | 'system'): Promise<void> =>
    ipcRenderer.invoke('theme:set', source),
  notify: (title: string, body: string): Promise<void> =>
    ipcRenderer.invoke('notify', title, body),
  openExternalUrl: (url: string): Promise<boolean> => ipcRenderer.invoke('external:open', url),

  driveGetStatus: (): Promise<DriveSyncStatus> => ipcRenderer.invoke('drive:status'),
  driveConnect: (): Promise<DriveSyncStatus> => ipcRenderer.invoke('drive:connect'),
  driveDisconnect: (): Promise<DriveSyncStatus> => ipcRenderer.invoke('drive:disconnect'),
  driveSyncNow: (): Promise<DriveSyncStatus> => ipcRenderer.invoke('drive:syncNow'),
  driveGetClientId: (): Promise<string> => ipcRenderer.invoke('drive:getClientId'),
  driveSetClientId: (clientId: string): Promise<void> =>
    ipcRenderer.invoke('drive:setClientId', clientId),
  driveGetClientSecret: (): Promise<string> => ipcRenderer.invoke('drive:getClientSecret'),
  driveSetClientSecret: (clientSecret: string): Promise<void> =>
    ipcRenderer.invoke('drive:setClientSecret', clientSecret),

  onDriveStatusChange: (cb: (status: Partial<DriveSyncStatus>) => void): (() => void) => {
    const listener = (_event: unknown, status: Partial<DriveSyncStatus>): void => cb(status)
    ipcRenderer.on('drive:status-change', listener)
    return () => ipcRenderer.removeListener('drive:status-change', listener)
  },
  onDrivePostsChange: (cb: (payload: { posts: unknown[] }) => void): (() => void) => {
    const listener = (_event: unknown, payload: { posts: unknown[] }): void => cb(payload)
    ipcRenderer.on('drive:posts-changed', listener)
    return () => ipcRenderer.removeListener('drive:posts-changed', listener)
  },
  onDriveScratchpadChange: (cb: (payload: { text: string }) => void): (() => void) => {
    const listener = (_event: unknown, payload: { text: string }): void => cb(payload)
    ipcRenderer.on('drive:scratchpad-changed', listener)
    return () => ipcRenderer.removeListener('drive:scratchpad-changed', listener)
  },

  workspaceReadHydration: (): Promise<{ set: Record<string, string>; remove: string[] }> =>
    ipcRenderer.invoke('workspace:readHydration'),
  workspaceReportSnapshot: (snapshot: Record<string, string | null>): Promise<void> =>
    ipcRenderer.invoke('workspace:reportSnapshot', snapshot),
  onDriveWorkspaceChange: (
    cb: (payload: { set: Record<string, string>; remove: string[] }) => void
  ): (() => void) => {
    const listener = (
      _event: unknown,
      payload: { set: Record<string, string>; remove: string[] }
    ): void => cb(payload)
    ipcRenderer.on('drive:workspace-changed', listener)
    return () => ipcRenderer.removeListener('drive:workspace-changed', listener)
  }
}

contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('api', api)
