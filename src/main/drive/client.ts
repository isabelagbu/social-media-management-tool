import { getValidAccessToken } from './auth'

const FOLDER_MIME = 'application/vnd.google-apps.folder'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

export type DriveFileMeta = {
  id: string
  name: string
  modifiedTime: string
  /** v3 numeric file revision; useful for change detection. */
  version?: string
}

export class DriveError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export class NotConnectedError extends Error {
  constructor() {
    super('Not connected to Google Drive')
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getValidAccessToken()
  if (!token) throw new NotConnectedError()
  return { authorization: `Bearer ${token}` }
}

async function driveJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = {
    ...(init?.headers as Record<string, string> | undefined),
    ...(await authHeaders())
  }
  const res = await fetch(url, { ...init, headers })
  if (!res.ok) {
    const text = await res.text()
    throw new DriveError(res.status, `Drive API ${res.status}: ${text || res.statusText}`)
  }
  return (await res.json()) as T
}

export async function findFolder(name: string): Promise<DriveFileMeta | null> {
  const q = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and mimeType='${FOLDER_MIME}' and trashed=false`
  )
  const data = await driveJson<{ files: DriveFileMeta[] }>(
    `${DRIVE_API}/files?q=${q}&fields=files(id,name,modifiedTime,version)&pageSize=10`
  )
  return data.files?.[0] ?? null
}

export async function createFolder(name: string): Promise<DriveFileMeta> {
  return driveJson<DriveFileMeta>(`${DRIVE_API}/files?fields=id,name,modifiedTime,version`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME })
  })
}

export async function ensureFolder(name: string): Promise<DriveFileMeta> {
  const existing = await findFolder(name)
  if (existing) return existing
  return createFolder(name)
}

export async function findFileInFolder(
  name: string,
  folderId: string
): Promise<DriveFileMeta | null> {
  const q = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`
  )
  const data = await driveJson<{ files: DriveFileMeta[] }>(
    `${DRIVE_API}/files?q=${q}&fields=files(id,name,modifiedTime,version)&pageSize=10`
  )
  return data.files?.[0] ?? null
}

export async function getFileMeta(fileId: string): Promise<DriveFileMeta> {
  return driveJson<DriveFileMeta>(`${DRIVE_API}/files/${fileId}?fields=id,name,modifiedTime,version`)
}

export async function downloadJson<T>(fileId: string): Promise<T> {
  const headers = await authHeaders()
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, { headers })
  if (!res.ok) {
    const text = await res.text()
    throw new DriveError(res.status, `Drive download ${res.status}: ${text || res.statusText}`)
  }
  return (await res.json()) as T
}

/**
 * Multipart upload that creates the file (when fileId is null) or updates it (when given).
 * Drive returns updated metadata so callers can persist the new version/modifiedTime.
 */
export async function uploadJson(params: {
  fileId: string | null
  name: string
  parentFolderId: string
  data: unknown
}): Promise<DriveFileMeta> {
  const { fileId, name, parentFolderId, data } = params
  const boundary = `rsp_${Math.random().toString(16).slice(2)}`
  const metadata: Record<string, unknown> = { name }
  if (!fileId) metadata.parents = [parentFolderId]
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(data, null, 2)}\r\n` +
    `--${boundary}--`

  const url = fileId
    ? `${UPLOAD_API}/files/${fileId}?uploadType=multipart&fields=id,name,modifiedTime,version`
    : `${UPLOAD_API}/files?uploadType=multipart&fields=id,name,modifiedTime,version`
  const headers = {
    ...(await authHeaders()),
    'content-type': `multipart/related; boundary=${boundary}`
  }
  const res = await fetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers,
    body
  })
  if (!res.ok) {
    const text = await res.text()
    throw new DriveError(res.status, `Drive upload ${res.status}: ${text || res.statusText}`)
  }
  return (await res.json()) as DriveFileMeta
}
