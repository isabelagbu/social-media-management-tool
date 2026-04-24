import { app, BrowserWindow, clipboard, ipcMain, nativeTheme, Notification, shell } from 'electron'

app.name = 'Ready Set Post!'
import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { getSeedPosts, SEED_SCRATCHPAD } from './seed-data'

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

const STORE_NAME = 'content-store.json'
const SCRATCHPAD_NAME = 'scratchpad.json'

function storePath(): string {
  return join(app.getPath('userData'), STORE_NAME)
}

function scratchpadPath(): string {
  return join(app.getPath('userData'), SCRATCHPAD_NAME)
}

async function readStore(): Promise<{ posts: unknown[] }> {
  const p = storePath()
  if (!existsSync(p)) return { posts: getSeedPosts() }
  const raw = await readFile(p, 'utf-8')
  try {
    const data = JSON.parse(raw) as { posts?: unknown[] }
    return { posts: Array.isArray(data.posts) ? data.posts : [] }
  } catch {
    return { posts: [] }
  }
}

async function writeStore(data: { posts: unknown[] }): Promise<void> {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  await writeFile(storePath(), JSON.stringify(data, null, 2), 'utf-8')
}

async function readScratchpad(): Promise<string> {
  const p = scratchpadPath()
  if (!existsSync(p)) return SEED_SCRATCHPAD
  const raw = await readFile(p, 'utf-8')
  try {
    const data = JSON.parse(raw) as { text?: unknown }
    return typeof data.text === 'string' ? data.text : ''
  } catch {
    return ''
  }
}

async function writeScratchpad(text: string): Promise<void> {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  await writeFile(scratchpadPath(), JSON.stringify({ text: text ?? '' }, null, 2), 'utf-8')
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 800,
    minHeight: 560,
    title: 'Ready Set Post!',
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

  mainWindow.on('ready-to-show', () => mainWindow.show())
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Avoid `is.dev` from toolkit at module load — bundled code can run before `app` exists.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'system'
  if (process.platform === 'win32') {
    app.setAppUserModelId(app.isPackaged ? 'com.socialmediamanager.app' : process.execPath)
  }
  app.on('browser-window-created', (_, window) => watchWindowShortcuts(window))

  ipcMain.handle('store:read', () => readStore())
  ipcMain.handle('store:write', (_, payload: { posts: unknown[] }) => writeStore(payload))
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

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
