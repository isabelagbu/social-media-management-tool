import { useMemo, useRef, useState } from 'react'
import PostNotesFullView from '../components/PostNotesFullView'
import PostCreateModal from '../components/PostCreateModal'
import PostPills from '../components/PostPills'
import Tip from '../components/Tip'
import { pad2 } from '../posts/datetime'
import {
  livePostUrl,
  postHasContentNotes,
  newPostId,
  EMPTY_CONTENT_NOTES,
  type Post,
  type PostContentNotes
} from '../posts/types'

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function startOfToday(): Date {
  const t = new Date()
  return new Date(t.getFullYear(), t.getMonth(), t.getDate())
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

type Cell = {
  date: Date
  dateKey: string
  inMonth: boolean
  dayNum: number
}

function buildMonthGrid(viewMonth: Date): Cell[] {
  const y = viewMonth.getFullYear()
  const m = viewMonth.getMonth()
  const startDow = new Date(y, m, 1).getDay()
  const daysThisMonth = new Date(y, m + 1, 0).getDate()
  const cells: Cell[] = []
  const prevLast = new Date(y, m, 0).getDate()

  for (let i = 0; i < startDow; i++) {
    const day = prevLast - startDow + i + 1
    const d = new Date(y, m - 1, day)
    cells.push({ date: d, dateKey: dateKey(d), inMonth: false, dayNum: day })
  }
  for (let day = 1; day <= daysThisMonth; day++) {
    const d = new Date(y, m, day)
    cells.push({ date: d, dateKey: dateKey(d), inMonth: true, dayNum: day })
  }
  let next = 1
  while (cells.length % 7 !== 0) {
    const d = new Date(y, m + 1, next++)
    cells.push({ date: d, dateKey: dateKey(d), inMonth: false, dayNum: d.getDate() })
  }
  while (cells.length < 42) {
    const d = new Date(y, m + 1, next++)
    cells.push({ date: d, dateKey: dateKey(d), inMonth: false, dayNum: d.getDate() })
  }
  return cells
}

function groupPostsByLocalDate(posts: Post[]): Map<string, Post[]> {
  const map = new Map<string, Post[]>()
  for (const p of posts) {
    if (!p.scheduledAt) continue
    const k = dateKey(new Date(p.scheduledAt))
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(p)
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0
      const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0
      return ta - tb
    })
  }
  return map
}

export default function CalendarView({
  posts,
  setPosts
}: {
  posts: Post[]
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>
}): React.ReactElement {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()))
  const [selectedKey, setSelectedKey] = useState<string | null>(() => dateKey(startOfToday()))
  const [notesModalPostId, setNotesModalPostId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth])
  const byDay = useMemo(() => groupPostsByLocalDate(posts), [posts])

  const monthLabel = viewMonth.toLocaleString('default', { month: 'long', year: 'numeric' })
  const todayKey = dateKey(startOfToday())

  const notesModalPost =
    notesModalPostId !== null ? posts.find((p) => p.id === notesModalPostId) : undefined

  function setNotesForPost(id: string, contentNotes: PostContentNotes): void {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, contentNotes } : p)))
  }

  function prevMonth(): void {
    setViewMonth((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))
  }

  function nextMonth(): void {
    setViewMonth((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))
  }

  function goToday(): void {
    const t = startOfToday()
    setViewMonth(startOfMonth(t))
    setSelectedKey(dateKey(t))
  }

  function handleCreate(payload: {
    title: string
    body: string
    platforms: string[]
    accountIds: string[]
    status: 'draft' | 'scheduled'
    scheduledAt: string | null
  }): void {
    const newPost: Post = {
      id: newPostId(),
      title: payload.title,
      body: payload.body,
      platforms: payload.platforms,
      accountIds: payload.accountIds,
      status: payload.status,
      scheduledAt: payload.scheduledAt,
      postedUrl: null,
      contentNotes: { ...EMPTY_CONTENT_NOTES },
      createdAt: new Date().toISOString()
    }
    setPosts((prev) => [...prev, newPost])
    setShowCreate(false)
  }

  // ── Drag-to-reschedule ────────────────────────────────────
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const draggingPostId = useRef<string | null>(null)

  function handleDrop(targetDateKey: string): void {
    const id = draggingPostId.current
    if (!id) return
    setDragOverKey(null)
    draggingPostId.current = null
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        // Keep existing time, just move the date
        const existing = p.scheduledAt ? new Date(p.scheduledAt) : new Date()
        const [y, m, d] = targetDateKey.split('-').map(Number)
        const next = new Date(y, m - 1, d, existing.getHours(), existing.getMinutes())
        return { ...p, scheduledAt: next.toISOString() }
      })
    )
    // Switch day panel to the target date
    setSelectedKey(targetDateKey)
  }

  // Build initial ISO date from the selected calendar day (noon)
  const createInitialDate = useMemo(() => {
    if (!selectedKey) return undefined
    const [y, m, d] = selectedKey.split('-').map(Number)
    if (!y || !m || !d) return undefined
    return new Date(y, m - 1, d, 12, 0).toISOString()
  }, [selectedKey])

  return (
    <div className="page calendar-page">
      <header className="page-header">
        <h1>Calendar</h1>
        <p className="sub">Select a day to view or create scheduled posts.</p>
        <Tip>Click a date to open its post panel · Drag a post card onto a new date to reschedule it · Hover a date with posts to preview their titles</Tip>
      </header>

      <div className="calendar-layout">
        <div className="calendar-main card">
          <div className="calendar-toolbar">
            <button type="button" className="ghost" onClick={prevMonth} aria-label="Previous month">
              ‹
            </button>
            <h2 className="calendar-month-title">{monthLabel}</h2>
            <button type="button" className="ghost" onClick={nextMonth} aria-label="Next month">
              ›
            </button>
            <button type="button" className="primary calendar-today" onClick={goToday}>
              Today
            </button>
          </div>
          <div className="calendar-weekdays" aria-hidden>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => (
              <div key={w} className="calendar-weekday">
                {w}
              </div>
            ))}
          </div>
          <div className="calendar-grid" role="grid" aria-label="Month">
            {grid.map((cell) => {
              const dayPosts = byDay.get(cell.dateKey) ?? []
              const count = dayPosts.length
              const selected = selectedKey === cell.dateKey
              const today = cell.dateKey === todayKey
              return (
                <button
                  key={`${cell.dateKey}-${cell.inMonth}-${cell.dayNum}`}
                  type="button"
                  role="gridcell"
                  className={`calendar-day${cell.inMonth ? '' : ' other-month'}${selected ? ' selected' : ''}${today ? ' today' : ''}${dragOverKey === cell.dateKey ? ' drag-over' : ''}`}
                  onClick={() => setSelectedKey(cell.dateKey)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverKey(cell.dateKey) }}
                  onDragLeave={() => setDragOverKey(null)}
                  onDrop={() => handleDrop(cell.dateKey)}
                >
                  <span className="calendar-day-num">{cell.dayNum}</span>
                  {count > 0 && (
                    <>
                      <span className="calendar-day-badge" aria-label={`${count} scheduled`}>
                        {count}
                      </span>
                      <div className="calendar-day-tooltip" role="tooltip">
                        {dayPosts.map((p) => (
                          <span key={p.id} className="calendar-day-tooltip-item">
                            {p.title || 'Untitled'}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <aside className="calendar-panel card">
          {selectedKey ? (
            <DayPanelPosts
              dateKey={selectedKey}
              posts={byDay.get(selectedKey) ?? []}
              onOpenNotes={(postId) => setNotesModalPostId(postId)}
              onCreatePost={() => setShowCreate(true)}
              onDragStart={(postId) => { draggingPostId.current = postId }}
            />
          ) : (
            <p className="muted small">Select a day on the calendar.</p>
          )}
        </aside>
      </div>

      {notesModalPost && (
        <PostNotesFullView
          post={notesModalPost}
          onClose={() => setNotesModalPostId(null)}
          onNotesChange={(next) => setNotesForPost(notesModalPost.id, next)}
          onPostChange={(patch) => setPosts((prev) => prev.map((p) => p.id === notesModalPost.id ? { ...p, ...patch } : p))}
          onDelete={() => { setPosts((prev) => prev.filter((p) => p.id !== notesModalPost.id)); setNotesModalPostId(null) }}
        />
      )}

      {showCreate && (
        <PostCreateModal
          initialDraft={false}
          initialDate={createInitialDate}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}

function DayPanelPosts({
  dateKey,
  posts,
  onOpenNotes,
  onCreatePost,
  onDragStart
}: {
  dateKey: string
  posts: Post[]
  onOpenNotes: (postId: string) => void
  onCreatePost: () => void
  onDragStart: (postId: string) => void
}): React.ReactElement {
  const label = useMemo(() => {
    const [y, m, d] = dateKey.split('-').map(Number)
    if (!y || !m || !d) return dateKey
    return new Date(y, m - 1, d).toLocaleDateString('default', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }, [dateKey])

  return (
    <div className="day-panel">
      <div className="day-panel-header">
        <h2 className="day-panel-title">{label}</h2>
        <button type="button" className="primary day-panel-create-btn" onClick={onCreatePost}>
          + New post
        </button>
      </div>

      <section className="day-panel-section day-panel-events" aria-labelledby="day-scheduled-heading">
        <h3 id="day-scheduled-heading" className="day-panel-heading">
          Scheduled
        </h3>
        {posts.length === 0 ? (
          <p className="muted small">Nothing on this day yet.</p>
        ) : (
          <ul className="day-post-list">
            {posts.map((p) => (
              <li
                key={p.id}
                className="card post day-calendar-post"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  onDragStart(p.id)
                }}
              >
                <div className="post-top">
                  <div className="post-top-meta">
                    <span className={`badge status-${p.status}`}>{p.status}</span>
                    {p.scheduledAt && (
                      <span className="muted small">
                        {new Date(p.scheduledAt).toLocaleString('en-US', {
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
                    {postHasContentNotes(p) && (
                      <span className="badge post-notes-indicator" title="Has production notes">
                        Notes
                      </span>
                    )}
                  </div>
                  {(p.platforms.length > 0 || p.accountIds.length > 0) && (
                    <div className="post-top-pills" aria-label="Platforms">
                      <PostPills post={p} />
                    </div>
                  )}
                </div>

                <div
                  className="post-body-hit"
                  role="button"
                  tabIndex={0}
                  aria-haspopup="dialog"
                  aria-label="Open full-screen script and production notes"
                  onClick={() => onOpenNotes(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onOpenNotes(p.id)
                    }
                  }}
                >
                  <p className="day-post-title">{p.title}</p>
                  <p className="body">{p.body}</p>
                  <span className="muted small post-body-hit-hint">Click for full-screen notes</span>
                </div>

                {p.status === 'posted' && (
                  <p className="post-live-link-row">
                    <a
                      href={livePostUrl(p)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="post-live-link"
                      title={
                        !p.postedUrl?.trim()
                          ? 'Placeholder — set a real URL in Content'
                          : undefined
                      }
                    >
                      View live post
                    </a>
                  </p>
                )}

                {p.platforms.length === 0 && p.accountIds.length === 0 && (
                  <p className="muted small post-no-platforms">No platform tags</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
