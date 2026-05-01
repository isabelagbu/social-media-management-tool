import { app, safeStorage, shell } from 'electron'
import { createHash, randomBytes } from 'crypto'
import { createServer, type Server } from 'http'
import { existsSync } from 'fs'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { join } from 'path'

const TOKEN_FILE = 'drive-tokens.bin'
const CONFIG_FILE = 'drive-config.json'
const SCOPES = ['https://www.googleapis.com/auth/drive.file']
const SUCCESS_HTML =
  '<!doctype html><html><head><meta charset="utf-8"><title>Connected to Ready Set Post</title>' +
  '<style>body{font-family:-apple-system,Segoe UI,Helvetica,sans-serif;background:#fff8fa;color:#1a1a1a;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}' +
  '.card{background:#fff;padding:36px 48px;border-radius:18px;box-shadow:0 10px 30px rgba(0,0,0,.08);text-align:center;max-width:420px}' +
  'h1{margin:0 0 8px;font-size:20px;color:#cc4f7e}p{margin:0;color:#555;font-size:14px;line-height:1.5}</style></head>' +
  '<body><div class="card"><h1>You are connected to Google Drive</h1><p>Ready Set Post will now sync to your Drive. You can close this tab and return to the app.</p></div></body></html>'

export type TokenSet = {
  accessToken: string
  refreshToken: string
  expiry: number
  scope: string
  email: string | null
}

export type DriveConfig = {
  clientId: string
  clientSecret: string
}

export function hasManagedDriveCredentials(): boolean {
  return (process.env.GOOGLE_CLIENT_ID || '').trim().length > 0
}

function tokenPath(): string {
  return join(app.getPath('userData'), TOKEN_FILE)
}

function configPath(): string {
  return join(app.getPath('userData'), CONFIG_FILE)
}

async function ensureUserDataDir(): Promise<void> {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export async function readDriveConfig(): Promise<DriveConfig> {
  // Build-time env wins so production builds can ship with a default client id.
  const envId = (process.env.GOOGLE_CLIENT_ID || '').trim()
  const envSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim()
  if (envId) return { clientId: envId, clientSecret: envSecret }
  try {
    if (!existsSync(configPath())) return { clientId: '', clientSecret: '' }
    const raw = await readFile(configPath(), 'utf-8')
    const data = JSON.parse(raw) as { clientId?: unknown; clientSecret?: unknown }
    return {
      clientId: typeof data.clientId === 'string' ? data.clientId.trim() : '',
      clientSecret: typeof data.clientSecret === 'string' ? data.clientSecret.trim() : ''
    }
  } catch {
    return { clientId: '', clientSecret: '' }
  }
}

export async function writeDriveConfig(next: DriveConfig): Promise<void> {
  await ensureUserDataDir()
  await writeFile(
    configPath(),
    JSON.stringify(
      { clientId: next.clientId.trim(), clientSecret: next.clientSecret.trim() },
      null,
      2
    ),
    'utf-8'
  )
}

export async function getStoredTokens(): Promise<TokenSet | null> {
  try {
    if (!existsSync(tokenPath())) return null
    const raw = await readFile(tokenPath())
    const json = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(raw)
      : raw.toString('utf-8')
    const parsed = JSON.parse(json) as Partial<TokenSet>
    if (!parsed || typeof parsed.accessToken !== 'string' || typeof parsed.refreshToken !== 'string') {
      return null
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiry: typeof parsed.expiry === 'number' ? parsed.expiry : 0,
      scope: typeof parsed.scope === 'string' ? parsed.scope : SCOPES.join(' '),
      email: typeof parsed.email === 'string' ? parsed.email : null
    }
  } catch {
    return null
  }
}

async function saveTokens(tokens: TokenSet): Promise<void> {
  await ensureUserDataDir()
  const json = JSON.stringify(tokens)
  if (safeStorage.isEncryptionAvailable()) {
    await writeFile(tokenPath(), safeStorage.encryptString(json))
  } else {
    await writeFile(tokenPath(), json, 'utf-8')
  }
}

export async function clearTokens(): Promise<void> {
  try {
    await unlink(tokenPath())
  } catch {
    /* ignore */
  }
}

async function fetchUserEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {
      headers: { authorization: `Bearer ${accessToken}` }
    })
    if (!res.ok) return null
    const data = (await res.json()) as { user?: { emailAddress?: string } }
    return data.user?.emailAddress ?? null
  } catch {
    return null
  }
}

/** Run the loopback PKCE flow. Resolves with the saved token set. */
export async function startOAuthFlow(): Promise<TokenSet> {
  const { clientId, clientSecret } = await readDriveConfig()
  if (!clientId) {
    throw new Error('Google Client ID is not configured. Add it under Settings → Google Drive sync.')
  }

  const { verifier, challenge } = generatePkce()

  return new Promise<TokenSet>((resolve, reject) => {
    let server: Server | null = null
    const timeout = setTimeout(() => {
      try {
        server?.close()
      } catch {
        /* ignore */
      }
      reject(new Error('Sign-in timed out. Please try again.'))
    }, 5 * 60 * 1000)

    server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://127.0.0.1')
        if (url.pathname !== '/callback') {
          res.writeHead(404).end('Not found')
          return
        }
        const code = url.searchParams.get('code')
        const errorParam = url.searchParams.get('error')
        if (errorParam) {
          res
            .writeHead(400, { 'content-type': 'text/html' })
            .end(`<h1>Sign-in cancelled</h1><p>${errorParam}</p>`)
          clearTimeout(timeout)
          server?.close()
          reject(new Error(errorParam))
          return
        }
        if (!code) {
          res.writeHead(400).end('Missing authorization code')
          return
        }
        const addr = server?.address()
        const port = typeof addr === 'object' && addr ? addr.port : 0
        const redirectUri = `http://127.0.0.1:${port}/callback`
        const body = new URLSearchParams({
          code,
          client_id: clientId,
          code_verifier: verifier,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
        if (clientSecret) body.set('client_secret', clientSecret)
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body
        })
        if (!tokenRes.ok) {
          const text = await tokenRes.text()
          res
            .writeHead(400, { 'content-type': 'text/html' })
            .end(`<h1>Token exchange failed</h1><pre>${text}</pre>`)
          clearTimeout(timeout)
          server?.close()
          reject(new Error(`Token exchange failed: ${text}`))
          return
        }
        const tokenData = (await tokenRes.json()) as {
          access_token: string
          refresh_token?: string
          expires_in: number
          scope: string
        }
        if (!tokenData.refresh_token) {
          res.writeHead(400, { 'content-type': 'text/html' }).end(
            '<h1>No refresh token returned</h1><p>Visit https://myaccount.google.com/permissions, remove Ready Set Post, and try again.</p>'
          )
          clearTimeout(timeout)
          server?.close()
          reject(
            new Error(
              'No refresh token returned. Remove Ready Set Post from your Google account permissions and try again.'
            )
          )
          return
        }
        const tokens: TokenSet = {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiry: Date.now() + Math.max(60, tokenData.expires_in - 60) * 1000,
          scope: tokenData.scope,
          email: await fetchUserEmail(tokenData.access_token)
        }
        await saveTokens(tokens)
        res.writeHead(200, { 'content-type': 'text/html' }).end(SUCCESS_HTML)
        clearTimeout(timeout)
        server?.close()
        resolve(tokens)
      } catch (err) {
        clearTimeout(timeout)
        try {
          server?.close()
        } catch {
          /* ignore */
        }
        reject(err as Error)
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server?.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      const redirectUri = `http://127.0.0.1:${port}/callback`
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        code_challenge: challenge,
        code_challenge_method: 'S256'
      })
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
      void shell.openExternal(authUrl)
    })
  })
}

/** Returns a valid access token, refreshing if necessary. Returns null when not connected. */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await getStoredTokens()
  if (!tokens) return null
  if (tokens.expiry > Date.now() + 5_000) return tokens.accessToken
  const { clientId, clientSecret } = await readDriveConfig()
  if (!clientId) return null
  const body = new URLSearchParams({
    refresh_token: tokens.refreshToken,
    client_id: clientId,
    grant_type: 'refresh_token'
  })
  if (clientSecret) body.set('client_secret', clientSecret)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!res.ok) return null
  const data = (await res.json()) as { access_token: string; expires_in: number }
  const next: TokenSet = {
    ...tokens,
    accessToken: data.access_token,
    expiry: Date.now() + Math.max(60, data.expires_in - 60) * 1000
  }
  await saveTokens(next)
  return next.accessToken
}

export async function isConnected(): Promise<boolean> {
  const tokens = await getStoredTokens()
  return !!tokens
}

export async function getConnectedEmail(): Promise<string | null> {
  const tokens = await getStoredTokens()
  return tokens?.email ?? null
}
