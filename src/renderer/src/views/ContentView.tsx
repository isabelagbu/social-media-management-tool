import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { playTriplePop } from '../utils/sound'
import ConfirmDialog from '../components/ConfirmDialog'
import Tip from '../components/Tip'
import PostEditorForm from '../components/PostEditorForm'
import PostNotesFullView from '../components/PostNotesFullView'
import PostCreateModal from '../components/PostCreateModal'
import PostPills from '../components/PostPills'
import PostCardThumb from '../components/PostCardThumb'
import PlatformLogoImg from '../components/PlatformLogoImg'
import { useAccounts } from '../accounts/context'
import { useEnabledPlatformFormLabels } from '../hooks/useEnabledPlatformFormLabels'
import { ACCOUNT_PLATFORM_LABELS, PLATFORM_META, type Account } from '../accounts/types'
import {
  livePostUrl,
  newPostId,
  EMPTY_CONTENT_NOTES,
  contentNotesText,
  type Post,
  type PostContentNotes,
  type Status
} from '../posts/types'
import { WORKSPACE_SYNCED_EVENT } from '../workspace/sync'

const FILTER_NONE = '__none__'

const CONTENT_SECTION_STORAGE_KEY = 'smm-content-section'

type ContentSection = 'drafts' | 'content'

function readStoredSection(): ContentSection {
  try {
    const t = localStorage.getItem(CONTENT_SECTION_STORAGE_KEY)
    if (t === 'drafts' || t === 'content') return t
  } catch {
    /* ignore */
  }
  return 'content'
}

function persistSection(section: ContentSection): void {
  try {
    localStorage.setItem(CONTENT_SECTION_STORAGE_KEY, section)
  } catch {
    /* ignore */
  }
}

function matchesSection(post: Post, section: ContentSection): boolean {
  if (section === 'drafts') return post.status === 'draft'
  return post.status === 'scheduled' || post.status === 'posted'
}

function matchesFilters(post: Post, selected: Set<string>, accounts: Account[]): boolean {
  if (selected.size === 0) return true
  const wantsNone = selected.has(FILTER_NONE)
  const keys = [...selected].filter((k) => k !== FILTER_NONE)

  const matchesNone = wantsNone && post.platforms.length === 0 && post.accountIds.length === 0

  const matchesKey = keys.some((k) => {
    // Account ID key — post must have that account selected
    if (post.accountIds.includes(k)) return true
    // Platform name key — match by platform name OR by account whose platform matches
    if (post.platforms.includes(k)) return true
    const platformKey = ACCOUNT_PLATFORM_LABELS[k]
    if (platformKey) {
      return post.accountIds.some((id) => accounts.find((a) => a.id === id)?.platform === platformKey)
    }
    return false
  })

  if (wantsNone && keys.length === 0) return matchesNone
  if (!wantsNone) return matchesKey
  return matchesNone || matchesKey
}

function matchesStatusFilter(post: Post, selected: Set<Status>): boolean {
  if (selected.size === 0) return true
  return selected.has(post.status)
}

function matchesSearch(post: Post, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  if (post.title.toLowerCase().includes(q)) return true
  if (post.body.toLowerCase().includes(q)) return true
  if (post.platforms.some((p) => p.toLowerCase().includes(q))) return true
  return contentNotesText(post.contentNotes).toLowerCase().includes(q)
}

function contentListPreviewText(post: Post): string {
  const caption = post.contentNotes.caption.trim()
  const hashtags = post.contentNotes.hashtags.trim()
  const combined = [caption, hashtags].filter(Boolean).join('\n')
  return combined || post.body
}

type SortOrder = 'newest' | 'oldest'

/** Status filters exclude draft — use the Draft tab for drafts. */
const STATUS_FILTER_OPTIONS: { value: Exclude<Status, 'draft'>; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'posted', label: 'Posted' }
]

export default function ContentView({
  posts,
  setPosts,
  initialSection,
  initialStatusFilter,
  initialOpenPostId,
  onConsumeInitialOpen
}: {
  posts: Post[]
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>
  initialSection?: ContentSection
  initialStatusFilter?: Status
  /** Open full details for this post (e.g. from Dashboard). */
  initialOpenPostId?: string
  onConsumeInitialOpen?: () => void
}): React.ReactElement {
  const { accounts } = useAccounts()
  const enabledFormPlatformLabels = useEnabledPlatformFormLabels()
  const [section, setSection] = useState<ContentSection>(initialSection ?? readStoredSection())
  const [filterSelected, setFilterSelected] = useState<Set<string>>(() => new Set())
  const [statusFilterSelected, setStatusFilterSelected] = useState<Set<Status>>(
    () => initialStatusFilter ? new Set([initialStatusFilter]) : new Set()
  )
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notesModalPostId, setNotesModalPostId] = useState<string | null>(() => initialOpenPostId ?? null)
  const [createOpen, setCreateOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useLayoutEffect(() => {
    if (initialOpenPostId) setNotesModalPostId(initialOpenPostId)
  }, [initialOpenPostId])

  const postsInSection = useMemo(
    () => posts.filter((p) => matchesSection(p, section)),
    [posts, section]
  )

  const filtered = useMemo(() => {
    const q = search.trim()
    const list = posts.filter(
      (p) =>
        matchesSection(p, section) &&
        matchesFilters(p, filterSelected, accounts) &&
        (section === 'drafts' ? true : matchesStatusFilter(p, statusFilterSelected)) &&
        matchesSearch(p, q)
    )
    const mul = sortOrder === 'newest' ? -1 : 1
    return [...list].sort(
      (a, b) =>
        mul * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    )
  }, [posts, section, filterSelected, statusFilterSelected, search, sortOrder, accounts])

  useEffect(() => {
    persistSection(section)
  }, [section])

  useEffect(() => {
    function onWorkspaceSynced(): void {
      setSection(readStoredSection())
    }
    window.addEventListener(WORKSPACE_SYNCED_EVENT, onWorkspaceSynced)
    return () => window.removeEventListener(WORKSPACE_SYNCED_EVENT, onWorkspaceSynced)
  }, [])

  useEffect(() => {
    function postInCurrentSection(id: string): boolean {
      const p = posts.find((x) => x.id === id)
      return p !== undefined && matchesSection(p, section)
    }
    setEditingId((id) => (id !== null && !postInCurrentSection(id) ? null : id))
    setNotesModalPostId((id) => (id !== null && !postInCurrentSection(id) ? null : id))
  }, [section, posts])

  function toggleFilter(key: string): void {
    setFilterSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function clearFilters(): void {
    setFilterSelected(new Set())
    setStatusFilterSelected(new Set())
  }

  function toggleStatusFilter(status: Status): void {
    setStatusFilterSelected((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  function updatePost(id: string, patch: Partial<Post>): void {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p))
    )
  }

  function removePost(id: string): void {
    setPosts((prev) => prev.filter((p) => p.id !== id))
    setEditingId((e) => (e === id ? null : e))
    setNotesModalPostId((n) => (n === id ? null : n))
    setConfirmDeleteId(null)
  }

  function setNotesForPost(id: string, contentNotes: PostContentNotes): void {
    updatePost(id, { contentNotes })
  }

  const notesModalPost =
    notesModalPostId !== null ? posts.find((p) => p.id === notesModalPostId) : undefined

  type FilterRow =
    | { kind: 'platform'; key: string; label: string }
    | { kind: 'account'; key: string; label: string }

  const filterRows: FilterRow[] = useMemo(
    () => [
      ...enabledFormPlatformLabels.flatMap((p): FilterRow[] => {
        const platformKey = ACCOUNT_PLATFORM_LABELS[p]
        const platformAccounts = platformKey ? accounts.filter((a) => a.platform === platformKey) : []
        const accountRows =
          platformAccounts.length <= 1
            ? []
            : platformAccounts.map((acc): FilterRow => ({
                kind: 'account',
                key: acc.id,
                label: acc.name
              }))
        return [
          { kind: 'platform', key: p, label: p },
          ...accountRows
        ]
      })
    ],
    [enabledFormPlatformLabels, accounts]
  )

  function openCreate(): void {
    setCreateOpen(true)
    setEditingId(null)
    setNotesModalPostId(null)
  }

  function createPost(payload: {
    title: string
    body: string
    platforms: string[]
    accountIds: string[]
    status: Status
    scheduledAt: string | null
    postedUrl: string | null
  }): void {
    const nowIso = new Date().toISOString()
    const post: Post = {
      id: newPostId(),
      title: payload.title,
      body: payload.body,
      platforms: payload.platforms,
      accountIds: payload.accountIds,
      status: payload.status,
      scheduledAt: payload.status === 'scheduled' ? payload.scheduledAt : null,
      postedUrl: payload.status === 'posted' ? payload.postedUrl : null,
      contentNotes: { ...EMPTY_CONTENT_NOTES, caption: payload.body.trim() },
      createdAt: nowIso,
      updatedAt: nowIso
    }
    setPosts((prev) => [post, ...prev])
    setCreateOpen(false)
    setSection(payload.status === 'draft' ? 'drafts' : 'content')
  }

  return (
    <div className="page content-view-page">
      <header className="page-header">
        <h1>Content</h1>
        <p className="sub">Manage all your posts and drafts in one place.</p>
        <Tip>Switch tabs for Drafts vs Content · Filter by platform or status in the side panel · Click any post for full details · Hit + to create a new post</Tip>
      </header>

      <div className="content-section-tabs" role="tablist" aria-label="Content area">
        <button
          type="button"
          role="tab"
          id="content-tab-content"
          aria-selected={section === 'content'}
          aria-controls="content-panel-main"
          className={`content-section-tab${section === 'content' ? ' active' : ''}`}
          onClick={() => setSection('content')}
        >
          Content
        </button>
        <button
          type="button"
          role="tab"
          id="content-tab-drafts"
          aria-selected={section === 'drafts'}
          aria-controls="content-panel-main"
          className={`content-section-tab${section === 'drafts' ? ' active' : ''}`}
          onClick={() => setSection('drafts')}
        >
          Draft
        </button>
      </div>

      <div className="content-filter-layout" id="content-panel-main" role="tabpanel">
        <aside className="content-filter-panel card" aria-label="Content filters">
          <h2 className="filter-panel-title">Platforms &amp; accounts</h2>
          <button type="button" className="ghost filter-clear" onClick={clearFilters}>
            Clear all filters
          </button>
          <ul className="filter-list">
            {filterRows.map((row) => (
              <li key={row.key}>
                <label className={`filter-row${row.kind === 'account' ? ' filter-row--account' : ''}`}>
                  <input
                    type="checkbox"
                    checked={filterSelected.has(row.key)}
                    onChange={() => toggleFilter(row.key)}
                  />
                  {row.kind === 'platform' && ACCOUNT_PLATFORM_LABELS[row.label] && (
                    <PlatformLogoImg
                      platform={ACCOUNT_PLATFORM_LABELS[row.label]}
                      size={16}
                      className="filter-platform-icon"
                    />
                  )}
                  <span>{row.label}</span>
                </label>
              </li>
            ))}
          </ul>

          <h2 className="filter-panel-title filter-panel-title-spaced">Status</h2>
          <ul className="filter-list">
            {STATUS_FILTER_OPTIONS.map(({ value, label }) => (
              <li key={value}>
                <label className="filter-row">
                  <input
                    type="checkbox"
                    checked={statusFilterSelected.has(value)}
                    onChange={() => toggleStatusFilter(value)}
                  />
                  <span>{label}</span>
                </label>
              </li>
            ))}
          </ul>

          <div className="filter-section-divider" />

          <h2 className="filter-panel-title">Order</h2>
          <p className="filter-panel-hint muted small">By date created</p>
          <div className="filter-fieldset" role="group" aria-label="Sort by created date">
            <ul className="filter-list filter-radio-list">
              <li>
                <label className="filter-row filter-radio-row">
                  <input
                    type="radio"
                    name="content-sort-order"
                    checked={sortOrder === 'newest'}
                    onChange={() => setSortOrder('newest')}
                  />
                  <span>Newest first</span>
                </label>
              </li>
              <li>
                <label className="filter-row filter-radio-row">
                  <input
                    type="radio"
                    name="content-sort-order"
                    checked={sortOrder === 'oldest'}
                    onChange={() => setSortOrder('oldest')}
                  />
                  <span>Oldest first</span>
                </label>
              </li>
            </ul>
          </div>

        </aside>

        <div className="content-list-panel">
          <div className="content-search-row">
            <label className="label" htmlFor="content-search">
              Search
            </label>
            <input
              id="content-search"
              className="content-search-input"
              type="search"
              placeholder="Search post text or platforms…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <p className="muted small content-count">
            {filtered.length} of {postsInSection.length} in {section === 'drafts' ? 'Draft' : 'Content'}
            <span className="content-count-total">
              {' '}
              · {posts.length} total
            </span>
          </p>
          {!createOpen && (
            <button type="button" className="primary content-create-button" onClick={openCreate}>
              Create post
            </button>
          )}
          <ul className="list">
            {filtered.map((post) => (
              <li key={post.id} className="card post">
                <div className="post-top">
                  <div className="post-top-meta">
                    <span className={`badge status-${post.status}`}>{post.status}</span>
                    {post.scheduledAt && (
                      <span className="muted small">
                        {new Date(post.scheduledAt).toLocaleString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                    )}
                  </div>
                  {(post.platforms.length > 0 || post.accountIds.length > 0) && (
                    <div className="post-top-pills" aria-label="Platforms">
                      <PostPills post={post} />
                    </div>
                  )}
                </div>
                {editingId === post.id ? (
                  <PostEditorForm
                    post={post}
                    onSave={(patch) => {
                      updatePost(post.id, patch)
                      setEditingId(null)
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <div
                      className={`post-body-hit${post.status === 'posted' && post.postedUrl ? ' post-body-hit--with-thumb' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-haspopup="dialog"
                      aria-label="Open full details"
                      onClick={() => setNotesModalPostId(post.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setNotesModalPostId(post.id)
                        }
                      }}
                    >
                      {post.status === 'posted' && post.postedUrl && (
                        <PostCardThumb postedUrl={post.postedUrl} />
                      )}
                      <div className="post-body-hit-text">
                        <p className="post-title">{post.title}</p>
                        <p className="body">{contentListPreviewText(post)}</p>
                        <span className="muted small post-body-hit-hint">
                          Click for full details
                        </span>
                      </div>
                    </div>
                    {post.status === 'posted' && (
                      <p className="post-live-link-row">
                        <a
                          href={livePostUrl(post)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="post-live-link"
                          title={
                            !post.postedUrl?.trim()
                              ? 'Placeholder — set a real URL in Edit'
                              : undefined
                          }
                        >
                          View live post
                        </a>
                      </p>
                    )}
                    {post.platforms.length === 0 && post.accountIds.length === 0 && (
                      <p className="muted small post-no-platforms">No platform tags</p>
                    )}
                    <div
                      className="row actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          setNotesModalPostId(null)
                          setEditingId(post.id)
                        }}
                      >
                        Edit
                      </button>
                      {post.status !== 'posted' && (
                        <button
                          type="button"
                          className="ghost"
                          data-silent
                          onClick={() => {
                            playTriplePop()
                            updatePost(post.id, { status: 'posted', postedUrl: null })
                          }}
                        >
                          Mark posted
                        </button>
                      )}
                      <button type="button" className="danger ghost" onClick={() => setConfirmDeleteId(post.id)}>
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
          {filtered.length === 0 && (
            postsInSection.length === 0 ? (
              <div className="content-empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" width="44" height="44" aria-hidden>
                  {section === 'drafts' ? (
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  ) : (
                    <>
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 3" />
                    </>
                  )}
                </svg>
                <p className="content-empty-heading">
                  {section === 'drafts' ? 'No drafts yet' : 'Nothing here yet'}
                </p>
                <p className="muted small content-empty-sub">
                  {section === 'drafts'
                    ? 'Start writing — hit the + button to create your first draft.'
                    : 'Create a post and schedule it, or mark one as posted to see it here.'}
                </p>
              </div>
            ) : (
              <div className="content-empty-state content-empty-state--filtered">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" width="36" height="36" aria-hidden>
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <p className="content-empty-heading">No posts match</p>
                <p className="muted small content-empty-sub">Try adjusting your search or clearing the filters.</p>
              </div>
            )
          )}
        </div>
      </div>

      {notesModalPost && (
        <PostNotesFullView
          post={notesModalPost}
          onClose={() => {
            setNotesModalPostId(null)
            onConsumeInitialOpen?.()
          }}
          onNotesChange={(next) => setNotesForPost(notesModalPost.id, next)}
          onPostChange={(patch) => updatePost(notesModalPost.id, patch)}
          onDelete={() => {
            removePost(notesModalPost.id)
            onConsumeInitialOpen?.()
          }}
        />
      )}

      {createOpen && (
        <PostCreateModal
          initialDraft={section === 'drafts'}
          onClose={() => setCreateOpen(false)}
          onCreate={createPost}
        />
      )}

      {confirmDeleteId && (() => {
        const post = posts.find((p) => p.id === confirmDeleteId)
        return (
          <ConfirmDialog
            title="Delete post?"
            message={post ? `"${post.title || 'Untitled'}" will be permanently deleted.` : 'This post will be permanently deleted.'}
            confirmLabel="Delete"
            onConfirm={() => removePost(confirmDeleteId)}
            onCancel={() => setConfirmDeleteId(null)}
          />
        )
      })()}
    </div>
  )
}
