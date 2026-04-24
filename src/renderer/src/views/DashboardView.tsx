import { useEffect, useRef, useState, useCallback } from 'react'
import PostPills from '../components/PostPills'
import Tip from '../components/Tip'
import BannerCropModal from '../components/BannerCropModal'
import { isBannerEnabled } from './SettingsView'
import { PLATFORM_META } from '../accounts/types'
import type { Platform } from '../accounts/types'
import type { NavId } from '../nav'
import type { Post } from '../posts/types'

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

function truncate(s: string, n: number): string {
  const t = s.trim().replace(/\s+/g, ' ')
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
}

function urgency(iso: string): 'urgent' | 'soon' | 'later' {
  const diff = new Date(iso).getTime() - Date.now()
  const hours = diff / (1000 * 60 * 60)
  if (hours < 24) return 'urgent'
  if (hours < 72) return 'soon'
  return 'later'
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (hours < 1) return 'Very soon'
  if (hours < 24) return `In ${hours}h`
  if (days === 1) return 'Tomorrow'
  return `In ${days}d`
}


// ── Per-platform brand gradients for placeholder thumbnails ──────────────────
const PLATFORM_GRADIENTS: Partial<Record<Platform, string>> = {
  instagram: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
  tiktok:    'linear-gradient(135deg, #010101 0%, #161616 50%, #69c9d0 100%)',
  youtube:   'linear-gradient(135deg, #ff0000, #cc0000)',
  linkedin:  'linear-gradient(135deg, #0077b5, #004f80)',
  x:         'linear-gradient(135deg, #14171a, #333)',
}

function youTubeThumbnail(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([^&?\s/]+)/)
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null
}

function PostThumbnailCard({ post }: { post: Post }): React.ReactElement {
  const [thumb, setThumb] = useState<string | null>(null)
  const [thumbErr, setThumbErr] = useState(false)

  const primaryPlatform = (post.platforms[0] ?? null) as Platform | null
  const gradient = primaryPlatform ? (PLATFORM_GRADIENTS[primaryPlatform] ?? 'linear-gradient(135deg, var(--accent-soft), var(--surface-muted))') : 'linear-gradient(135deg, var(--accent-soft), var(--surface-muted))'
  const platformLabel = primaryPlatform ? PLATFORM_META[primaryPlatform]?.label : null

  useEffect(() => {
    if (!post.postedUrl) return
    const yt = youTubeThumbnail(post.postedUrl)
    if (yt) { setThumb(yt); return }
    if (/tiktok\.com/.test(post.postedUrl)) {
      fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(post.postedUrl)}`)
        .then((r) => r.json())
        .then((d) => { if (d.thumbnail_url) setThumb(d.thumbnail_url) })
        .catch(() => {})
    }
  }, [post.postedUrl])

  const showImage = thumb && !thumbErr

  return (
    <div className="recent-post-card card">
      <div
        className="recent-post-thumb"
        style={showImage ? undefined : { background: gradient }}
      >
        {showImage ? (
          <img
            src={thumb!}
            alt={post.title || 'Post thumbnail'}
            className="recent-post-thumb-img"
            onError={() => setThumbErr(true)}
          />
        ) : (
          <div className="recent-post-thumb-placeholder">
            {platformLabel && (
              <span className="recent-post-thumb-platform">{platformLabel}</span>
            )}
            <p className="recent-post-thumb-text">
              {post.title || post.body.slice(0, 60) || 'Untitled'}
            </p>
          </div>
        )}
      </div>
      <div className="recent-post-info">
        <p className="recent-post-title">{post.title || 'Untitled'}</p>
        <div className="recent-post-meta">
          {(post.platforms.length > 0 || post.accountIds.length > 0) && (
            <PostPills post={post} />
          )}
          {post.scheduledAt && (
            <span className="muted small recent-post-date">
              {new Date(post.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DashboardView({
  posts,
  onNavigate
}: {
  posts: Post[]
  onNavigate: (id: NavId) => void
}): React.ReactElement {
  const now = Date.now()

  const drafts = posts.filter((p) => p.status === 'draft')
  const scheduled = posts.filter((p) => p.status === 'scheduled')
  const posted = posts.filter((p) => p.status === 'posted')
  const overdue = scheduled.filter((p) => p.scheduledAt && new Date(p.scheduledAt).getTime() < now)

  const upcoming = [...scheduled]
    .filter((p) => p.scheduledAt && new Date(p.scheduledAt).getTime() >= now)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
    .slice(0, 5)

  const recentDrafts = [...drafts]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4)

  const recentPosted = [...posted]
    .sort((a, b) => new Date(b.scheduledAt ?? b.createdAt).getTime() - new Date(a.scheduledAt ?? a.createdAt).getTime())
    .slice(0, 6)

  const total = posts.length

  const GREETING_KEY = 'smm-dash-greeting'
  const DEFAULT_GREETING = 'Welcome back!'
  const [greetingText, setGreetingText] = useState<string>(() => {
    try { return localStorage.getItem(GREETING_KEY) || DEFAULT_GREETING } catch { return DEFAULT_GREETING }
  })
  const [editingGreeting, setEditingGreeting] = useState(false)
  const [greetingDraft, setGreetingDraft] = useState(greetingText)
  const greetingInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingGreeting) greetingInputRef.current?.select()
  }, [editingGreeting])

  const saveGreeting = useCallback(() => {
    const val = greetingDraft.trim() || DEFAULT_GREETING
    setGreetingText(val)
    setGreetingDraft(val)
    try { localStorage.setItem(GREETING_KEY, val) } catch { /* ignore */ }
    setEditingGreeting(false)
  }, [greetingDraft])

  const BANNER_KEY = 'smm-dash-banner'
  const [banner, setBanner] = useState<string | null>(() => {
    try { return localStorage.getItem(BANNER_KEY) } catch { return null }
  })
  const [bannerEnabled, setBannerEnabled] = useState(() => isBannerEnabled())
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onBannerChange(e: Event): void {
      setBannerEnabled((e as CustomEvent<boolean>).detail)
    }
    window.addEventListener('smm-banner-change', onBannerChange)
    return () => window.removeEventListener('smm-banner-change', onBannerChange)
  }, [])

  function pickBanner(): void {
    fileInputRef.current?.click()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function onCropConfirm(croppedDataUrl: string): void {
    setBanner(croppedDataUrl)
    try { localStorage.setItem(BANNER_KEY, croppedDataUrl) } catch { /* ignore */ }
    setCropSrc(null)
  }

  function removeBanner(): void {
    setBanner(null)
    try { localStorage.removeItem(BANNER_KEY) } catch { /* ignore */ }
  }

  return (
    <div className="dashboard-shell">
      {/* ── Banner — lives outside .page so it spans full width ── */}
      {bannerEnabled && <div className="dash-banner" onClick={pickBanner} role="button" tabIndex={0} aria-label="Change header image" onKeyDown={(e) => e.key === 'Enter' && pickBanner()}>
        {banner
          ? <img src={banner} className="dash-banner-img" alt="Dashboard header" />
          : <div className="dash-banner-placeholder"><span className="dash-banner-hint">Click to add a cover photo</span></div>
        }
        <div className="dash-banner-overlay">
          <span className="dash-banner-change-btn">📷 Change cover</span>
          {banner && (
            <button
              type="button"
              className="dash-banner-remove-btn"
              onClick={(e) => { e.stopPropagation(); removeBanner() }}
              aria-label="Remove cover photo"
            >
              Remove
            </button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
      </div>}

      <div className="page dashboard">
      {/* ── Greeting ── */}
      <div className="dash-greeting">
        <div>
          {editingGreeting ? (
            <input
              ref={greetingInputRef}
              className="dash-greeting-input"
              value={greetingDraft}
              onChange={(e) => setGreetingDraft(e.target.value)}
              onBlur={saveGreeting}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveGreeting()
                if (e.key === 'Escape') { setGreetingDraft(greetingText); setEditingGreeting(false) }
              }}
              maxLength={60}
              aria-label="Edit greeting"
            />
          ) : (
            <h1
              className="dash-greeting-title"
              onDoubleClick={() => { setGreetingDraft(greetingText); setEditingGreeting(true) }}
              title="Double-click to edit"
            >
              {greetingText}
            </h1>
          )}
          <p className="dash-greeting-date muted small">{todayLabel()}</p>
        </div>
        <button type="button" className="primary" onClick={() => onNavigate('content')}>
          + New post
        </button>
      </div>

      <Tip>Click a stat card to jump to that section · Overdue posts need attention — open the calendar to reschedule them</Tip>

      {/* ── Stat row ── */}
      <div className="stat-grid">
        {(
          [
            { label: 'Drafts', value: drafts.length, nav: 'content' },
            { label: 'Scheduled', value: scheduled.length, nav: 'calendar' },
            { label: 'Posted', value: posted.length, nav: 'content' },
            { label: 'Overdue', value: overdue.length, nav: 'calendar', danger: overdue.length > 0 },
            { label: 'Total', value: total, nav: null }
          ] as { label: string; value: number; nav: NavId | null; danger?: boolean }[]
        ).map(({ label, value, nav, danger }) =>
          nav ? (
            <button
              key={label}
              type="button"
              className={`stat-card${danger ? ' stat-card--overdue' : ''}`}
              onClick={() => onNavigate(nav)}
            >
              <span className="stat-value">{value}</span>
              <span className="stat-label">{label}</span>
            </button>
          ) : (
            <div key={label} className="stat-card static">
              <span className="stat-value">{value}</span>
              <span className="stat-label">{label}</span>
            </div>
          )
        )}
      </div>

      {/* ── Overdue warning ── */}
      {overdue.length > 0 && (
        <section className="dashboard-section card dash-overdue-card" aria-label="Overdue posts">
          <div className="section-head">
            <h2 className="dash-overdue-heading">
              ⚠ {overdue.length} overdue {overdue.length === 1 ? 'post' : 'posts'}
            </h2>
            <button type="button" className="ghost linkish" onClick={() => onNavigate('calendar')}>
              Open calendar
            </button>
          </div>
          <ul className="dash-overdue-list">
            {overdue
              .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
              .map((p) => (
                <li key={p.id} className="dash-overdue-item">
                  <span className="dash-overdue-title">{p.title}</span>
                  <span className="dash-overdue-time muted small">{fmt(p.scheduledAt!)}</span>
                  {(p.platforms.length > 0 || p.accountIds.length > 0) && (
                    <div className="dash-overdue-pills">
                      <PostPills post={p} />
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* ── Next up + Recent drafts stacked ── */}
      <div className="dash-bottom-grid">
        {/* Next up */}
        <section className="dashboard-section card">
          <div className="section-head">
            <h2>Next up</h2>
            <button type="button" className="ghost linkish" onClick={() => onNavigate('calendar')}>
              Open calendar
            </button>
          </div>
          {upcoming.length === 0 ? (
            <div className="dash-empty">
              <span className="dash-empty-icon">🗓</span>
              <p className="muted small">Nothing scheduled yet.</p>
            </div>
          ) : (
            <ul className="upcoming-list">
              {upcoming.map((p) => (
                <li key={p.id} className={`upcoming-item upcoming-item--${urgency(p.scheduledAt!)}`}>
                  <div className="upcoming-row">
                    <span className={`upcoming-badge upcoming-badge--${urgency(p.scheduledAt!)}`}>
                      {timeUntil(p.scheduledAt!)}
                    </span>
                    <span className="upcoming-time">{fmt(p.scheduledAt!)}</span>
                    {(p.platforms.length > 0 || p.accountIds.length > 0) && (
                      <div className="upcoming-pills">
                        <PostPills post={p} />
                      </div>
                    )}
                  </div>
                  <span className="upcoming-title">{p.title}</span>
                  {p.body.trim() && (
                    <span className="upcoming-preview">{truncate(p.body, 80)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent drafts */}
        <section className="dashboard-section card">
          <div className="section-head">
            <h2>Recent drafts</h2>
            <button type="button" className="ghost linkish" onClick={() => onNavigate('content')}>
              View all
            </button>
          </div>
          {recentDrafts.length === 0 ? (
            <div className="dash-empty">
              <span className="dash-empty-icon">✏️</span>
              <p className="muted small">No drafts yet.</p>
            </div>
          ) : (
            <ul className="draft-list">
              {recentDrafts.map((p) => (
                <li key={p.id} className="draft-item">
                  <span className="draft-title">{p.title}</span>
                  {(p.platforms.length > 0 || p.accountIds.length > 0) && (
                    <div className="draft-pills">
                      <PostPills post={p} />
                    </div>
                  )}
                  {p.body.trim() && (
                    <span className="draft-preview muted small">{truncate(p.body, 80)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Recent posts grid ── */}
      {recentPosted.length > 0 && (
        <section className="dashboard-section card dash-recent-posts">
          <div className="section-head">
            <h2>Recent posts</h2>
            <button type="button" className="ghost linkish" onClick={() => onNavigate('content')}>
              View all
            </button>
          </div>
          <div className="recent-posts-grid">
            {recentPosted.map((p) => (
              <PostThumbnailCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}
      </div>

      {cropSrc && (
        <BannerCropModal
          srcUrl={cropSrc}
          onConfirm={onCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  )
}
