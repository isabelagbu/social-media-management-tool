export type Status = 'draft' | 'scheduled' | 'posted'

/** Shown when a posted item has no `postedUrl` yet (replace per post in Edit). */
export const DUMMY_POSTED_URL = 'https://example.com/social-post-placeholder'

/** Per-post production notes (Content view). */
export type PostContentNotes = {
  caption: string
  hashtags: string
  notes: string
}

export const EMPTY_CONTENT_NOTES: PostContentNotes = {
  caption: '',
  hashtags: '',
  notes: ''
}

export function contentNotesText(notes: PostContentNotes | Record<string, unknown> | null | undefined): string {
  if (!notes || typeof notes !== 'object' || Array.isArray(notes)) return ''
  const o = notes as Record<string, unknown>
  const n = typeof o.notes === 'string' ? o.notes.trim() : ''
  const caption = typeof o.caption === 'string' ? o.caption.trim() : ''
  const hashtags = typeof o.hashtags === 'string' ? o.hashtags.trim() : ''
  if (n.length > 0 || caption || hashtags) return [caption, hashtags, n].filter(Boolean).join('\n\n')
  const script = typeof o.script === 'string' ? o.script.trim() : ''
  const other = typeof o.other === 'string' ? o.other.trim() : ''
  return [caption, hashtags, script, other].filter(Boolean).join('\n\n')
}

function parseContentNotes(raw: unknown): PostContentNotes {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...EMPTY_CONTENT_NOTES }
  }
  const o = raw as Record<string, unknown>
  const s = (k: string): string => (typeof o[k] === 'string' ? o[k].trim() : '')
  let caption = s('caption')
  const hashtags = s('hashtags')
  let notes = s('notes') || [s('script'), s('other')].filter(Boolean).join('\n\n')
  // If legacy data only has the old unified notes text, show it in Caption + Hashtags.
  if (!caption && !hashtags && notes) {
    caption = notes
    notes = ''
  }
  return {
    caption,
    hashtags,
    notes
  }
}

export type Post = {
  id: string
  /** Human-friendly title (required). */
  title: string
  body: string
  platforms: string[]
  /** IDs of specific accounts this post is targeted to (e.g. TikTok/Instagram/Threads/YouTube). */
  accountIds: string[]
  status: Status
  scheduledAt: string | null
  /** Canonical link to the live post or video when status is posted. */
  postedUrl: string | null
  contentNotes: PostContentNotes
  createdAt: string
  /** Last local modification time. Used for deterministic merging across devices. */
  updatedAt: string
}

/** Returns the patch with `updatedAt` set to now. Use whenever a post is mutated locally. */
export function withUpdatedAt<T extends Partial<Post>>(patch: T): T & { updatedAt: string } {
  return { ...patch, updatedAt: new Date().toISOString() }
}

/** Stamps every post in a list with a fresh `updatedAt`. Use when bulk-replacing the store. */
export function stampUpdatedAt<T extends Partial<Post>>(posts: T[]): (T & { updatedAt: string })[] {
  const now = new Date().toISOString()
  return posts.map((p) => ({ ...p, updatedAt: now }))
}

export function livePostUrl(post: Post): string | null {
  if (post.status !== 'posted') return null
  const u = post.postedUrl?.trim()
  return u && u.length > 0 ? u : DUMMY_POSTED_URL
}

export function postHasContentNotes(post: Post): boolean {
  return contentNotesText(post.contentNotes).length > 0
}

export const PLATFORM_OPTIONS = [
  'Instagram',
  'Threads',
  'TikTok',
  'YouTube',
  'X',
  'LinkedIn'
] as const

export function parsePost(raw: unknown): Post | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.body !== 'string') return null
  const platforms = Array.isArray(o.platforms) ? o.platforms.filter((p): p is string => typeof p === 'string') : []
  const accountIds = Array.isArray(o.accountIds) ? o.accountIds.filter((a): a is string => typeof a === 'string') : []
  const status = o.status === 'draft' || o.status === 'scheduled' || o.status === 'posted' ? o.status : 'draft'
  const scheduledAt = o.scheduledAt === null || typeof o.scheduledAt === 'string' ? o.scheduledAt : null
  const postedUrl =
    o.postedUrl === null || typeof o.postedUrl === 'string' ? o.postedUrl : null
  const createdAt = typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString()
  const updatedAt = typeof o.updatedAt === 'string' ? o.updatedAt : createdAt
  const contentNotes = parseContentNotes(o.contentNotes)
  const rawTitle = typeof o.title === 'string' ? o.title : ''
  const derivedTitle =
    rawTitle.trim().length > 0
      ? rawTitle.trim()
      : o.body
          .split('\n')[0]
          .trim()
          .slice(0, 80)
          .trim()
  return {
    id: o.id,
    title: derivedTitle.length > 0 ? derivedTitle : 'Untitled',
    body: o.body,
    platforms,
    accountIds,
    status,
    scheduledAt,
    postedUrl,
    contentNotes,
    createdAt,
    updatedAt
  }
}

export function newPostId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}
