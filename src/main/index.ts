import { app, BrowserWindow, clipboard, ipcMain, nativeTheme, Notification, shell } from 'electron'
import { join, resolve } from 'path'
import {
  demoPostListOutOfSyncWithSeed,
  getGenericSeedPosts,
  getSeedPosts,
  isDemoOnlyPostList,
  SEED_SCRATCHPAD
} from './seed-data'
import {
  connect as driveConnect,
  disconnect as driveDisconnect,
  getClientId as driveGetClientId,
  getClientSecret as driveGetClientSecret,
  getStatus as driveGetStatus,
  initDriveStore,
  readPosts as driveReadPosts,
  readScratchpad as driveReadScratchpad,
  replacePosts as driveReplacePosts,
  setClientId as driveSetClientId,
  setClientSecret as driveSetClientSecret,
  syncNow as driveSyncNow,
  writePosts as driveWritePosts,
  writeScratchpad as driveWriteScratchpad,
  readWorkspaceHydration as driveReadWorkspaceHydration,
  reportWorkspaceSnapshot as driveReportWorkspaceSnapshot
} from './drive/store'

const APP_NAME = 'Ready Set Post'
const APP_ICON_PATH = resolve(process.cwd(), 'build/icon.png')
const ALLOWED_EXTERNAL_HOSTS = new Set([
  'instagram.com',
  'threads.net',
  'tiktok.com',
  'youtube.com',
  'linkedin.com',
  'x.com'
])

app.setName(APP_NAME)

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  for (const allowed of ALLOWED_EXTERNAL_HOSTS) {
    if (host === allowed || host.endsWith(`.${allowed}`)) return true
  }
  return false
}

function toSafeExternalUrl(rawUrl: string): string | null {
  try {
    const input = rawUrl.trim()
    if (!input) return null
    const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(input) ? input : `https://${input}`
    const parsed = new URL(withScheme)
    if (parsed.protocol !== 'https:') return null
    if (!isAllowedHost(parsed.hostname)) return null
    return parsed.toString()
  } catch {
    return null
  }
}

/** DevTools (F12) in dev; block refresh/devtools shortcuts in production — avoids toolkit loading before `app` exists when bundled. */
function watchWindowShortcuts(win: BrowserWindow): void {
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const dev = !app.isPackaged
    if (dev) {
      if (input.code === 'F12') {
        event.preventDefault()
        const { webContents } = win
        if (webContents.isDevToolsOpened()) webContents.closeDevTools()
        else webContents.openDevTools({ mode: 'undocked' })
      }
    } else {
      if (input.code === 'KeyR' && (input.control || input.meta)) event.preventDefault()
      if (
        input.code === 'KeyI' &&
        ((input.alt && input.meta) || (input.control && input.shift))
      ) {
        event.preventDefault()
      }
    }
    if (input.code === 'Minus' && (input.control || input.meta)) event.preventDefault()
    if (input.code === 'Equal' && input.shift && (input.control || input.meta)) event.preventDefault()
  })
}

type RawPost = Record<string, unknown> & { id?: unknown }

/**
 * Reads posts from the local Drive cache, seeding/refreshing the demo set on first launch
 * or when the bundled DEMO_STORE_VERSION moves ahead of an unmodified demo store.
 */
async function readStore(): Promise<{ posts: unknown[] }> {
  const { posts } = await driveReadPosts()
  if (!posts || posts.length === 0) {
    const seeded = getSeedPosts()
    await driveWritePosts(seeded as RawPost[])
    return { posts: seeded }
  }
  if (isDemoOnlyPostList(posts) && demoPostListOutOfSyncWithSeed(posts)) {
    const next = getSeedPosts()
    await driveWritePosts(next as RawPost[])
    return { posts: next }
  }
  return { posts }
}

async function writeStore(data: { posts: unknown[] }): Promise<void> {
  await driveWritePosts((data.posts ?? []) as RawPost[])
}

async function replaceStoreWithDemoSeed(): Promise<{ posts: unknown[] }> {
  const posts = getSeedPosts()
  await driveReplacePosts(posts as RawPost[])
  return { posts }
}

async function replaceStoreWithGenericDemoSeed(): Promise<{ posts: unknown[] }> {
  const posts = getGenericSeedPosts()
  await driveReplacePosts(posts as RawPost[])
  return { posts }
}

async function readScratchpad(): Promise<string> {
  const text = await driveReadScratchpad()
  if (text) return text
  await driveWriteScratchpad(SEED_SCRATCHPAD)
  return SEED_SCRATCHPAD
}

async function writeScratchpad(text: string): Promise<void> {
  await driveWriteScratchpad(text ?? '')
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 800,
    minHeight: 560,
    title: APP_NAME,
    icon: APP_ICON_PATH,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#fff8fa',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      webviewTag: true
    }
  })

  if (app.isPackaged) {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = details.responseHeaders ?? {}
      const csp =
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "font-src 'self' data:; " +
        "connect-src 'self' https:; " +
        "media-src 'self' data:; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'; " +
        "frame-src 'self' https:; " +
        "frame-ancestors 'none'"
      callback({
        responseHeaders: {
          ...responseHeaders,
          'Content-Security-Policy': [csp]
        }
      })
    })
  }

  mainWindow.on('ready-to-show', () => mainWindow.show())
  mainWindow.webContents.setWindowOpenHandler((details) => {
    const safeUrl = toSafeExternalUrl(details.url)
    if (safeUrl) {
      void shell.openExternal(safeUrl)
    }
    return { action: 'deny' }
  })

  // Avoid `is.dev` from toolkit at module load — bundled code can run before `app` exists.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  app.setName(APP_NAME)
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(APP_ICON_PATH)
  }
  nativeTheme.themeSource = 'system'
  if (process.platform === 'win32') {
    app.setAppUserModelId(app.isPackaged ? 'com.socialmediamanager.app' : process.execPath)
  }
  app.on('browser-window-created', (_, window) => watchWindowShortcuts(window))

  await initDriveStore()

  ipcMain.handle('store:read', () => readStore())
  ipcMain.handle('store:write', (_, payload: { posts: unknown[] }) => writeStore(payload))
  ipcMain.handle('store:replaceDemo', () => replaceStoreWithDemoSeed())
  ipcMain.handle('store:replaceDemoGeneric', () => replaceStoreWithGenericDemoSeed())
  ipcMain.handle('clipboard:write', (_, text: string) => {
    clipboard.writeText(text ?? '')
    return true
  })
  ipcMain.handle('notes:read', () => readScratchpad())
  ipcMain.handle('notes:write', (_, text: string) => writeScratchpad(text))
  ipcMain.handle('theme:set', (_, source: 'light' | 'dark' | 'system') => {
    if (source === 'light' || source === 'dark' || source === 'system') {
      nativeTheme.themeSource = source
    }
  })
  ipcMain.handle('notify', (_, title: string, body: string) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show()
    }
  })
  ipcMain.handle('external:open', (_, rawUrl: string) => {
    if (typeof rawUrl !== 'string') return false
    const safeUrl = toSafeExternalUrl(rawUrl)
    if (!safeUrl) return false
    void shell.openExternal(safeUrl)
    return true
  })

  ipcMain.handle('drive:status', () => driveGetStatus())
  ipcMain.handle('drive:connect', () => driveConnect())
  ipcMain.handle('drive:disconnect', () => driveDisconnect())
  ipcMain.handle('drive:syncNow', () => driveSyncNow())
  ipcMain.handle('drive:getClientId', () => driveGetClientId())
  ipcMain.handle('drive:setClientId', (_, clientId: string) => driveSetClientId(clientId ?? ''))
  ipcMain.handle('drive:getClientSecret', () => driveGetClientSecret())
  ipcMain.handle('drive:setClientSecret', (_, clientSecret: string) =>
    driveSetClientSecret(clientSecret ?? '')
  )
  ipcMain.handle('workspace:readHydration', () => driveReadWorkspaceHydration())
  ipcMain.handle('workspace:reportSnapshot', (_, snapshot: Record<string, unknown>) =>
    driveReportWorkspaceSnapshot(snapshot ?? {})
  )

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
