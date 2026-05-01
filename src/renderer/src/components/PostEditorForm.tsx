import { useMemo, useState } from 'react'
import { useAccounts } from '../accounts/context'
import { ACCOUNT_PLATFORM_LABELS, PLATFORM_META } from '../accounts/types'
import { scheduledAtFromParts, toDateInputValue, toTimeInputValue } from '../posts/datetime'
import { PLATFORM_OPTIONS, type Post, type Status } from '../posts/types'
import { useEnabledPlatformFormLabels } from '../hooks/useEnabledPlatformFormLabels'
import PlatformLogoImg from './PlatformLogoImg'
import { playTriplePop } from '../utils/sound'
import ScheduleDateTimeFields from './ScheduleDateTimeFields'

export default function PostEditorForm({
  post,
  onSave,
  onCancel
}: {
  post: Post
  onSave: (patch: Partial<Post>) => void
  onCancel: () => void
}): React.ReactElement {
  const { accounts } = useAccounts()
  const formPlatformLabels = useEnabledPlatformFormLabels()
  const platformRowLabels = useMemo(() => {
    const enabled = new Set(formPlatformLabels)
    const extra = post.platforms.filter(
      (p) => (PLATFORM_OPTIONS as readonly string[]).includes(p) && !enabled.has(p as (typeof PLATFORM_OPTIONS)[number])
    )
    return [...formPlatformLabels, ...extra]
  }, [formPlatformLabels, post.platforms])

  const [title, setTitle] = useState(post.title)
  const [body, setBody] = useState(post.body)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(() =>
    // Filter out platform names that are now managed via account checkboxes
    post.platforms.filter((p) => {
      const platformKey = ACCOUNT_PLATFORM_LABELS[p]
      if (!platformKey) return true
      return !accounts.some((a) => a.platform === platformKey)
    })
  )
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(post.accountIds)
  const [dateStr, setDateStr] = useState(() =>
    post.scheduledAt ? toDateInputValue(post.scheduledAt) : ''
  )
  const [timeStr, setTimeStr] = useState(() =>
    post.scheduledAt ? toTimeInputValue(post.scheduledAt) : ''
  )
  const [noTime, setNoTime] = useState(() => !post.scheduledAt)
  const [status, setStatus] = useState<Status>(post.status)
  const [postedUrl, setPostedUrl] = useState(post.postedUrl ?? '')

  function togglePlatform(p: string): void {
    setSelectedPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  function toggleAccount(id: string): void {
    setSelectedAccountIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function save(): void {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    if (status === 'scheduled' && !dateStr.trim()) return

    const accountDerivedPlatforms = [
      ...new Set(
        selectedAccountIds
          .map((id) => accounts.find((a) => a.id === id)?.platform)
          .filter(Boolean)
          .map((p) => PLATFORM_META[p!].label)
      )
    ]
    const allPlatforms = [...new Set([...selectedPlatforms, ...accountDerivedPlatforms])]

    if (status === 'draft') {
      onSave({
        title: trimmedTitle,
        body: body.trim() || post.body,
        contentNotes: { ...post.contentNotes, caption: body.trim() || post.body },
        platforms: allPlatforms,
        accountIds: selectedAccountIds,
        scheduledAt: null,
        status: 'draft',
        postedUrl: null
      })
      return
    }
    const scheduledAt =
      !dateStr.trim() ? null : scheduledAtFromParts(dateStr, noTime ? '' : timeStr)
    if (status === 'scheduled' && !scheduledAt) return
    const nextStatus = status
    if (nextStatus === 'posted') playTriplePop()
    onSave({
      title: trimmedTitle,
      body: body.trim() || post.body,
      contentNotes: { ...post.contentNotes, caption: body.trim() || post.body },
      platforms: allPlatforms,
      accountIds: selectedAccountIds,
      scheduledAt,
      status: nextStatus,
      postedUrl: nextStatus === 'posted' ? (postedUrl.trim() || null) : null
    })
  }

  return (
    <div className="day-post-editor">
      <label>
        <span className="label">Title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. TikTok caption ideas"
          required
        />
      </label>
      <label>
        <span className="label">Caption + Hashtags</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <div className="grow">
        <span className="label" style={{ display: 'block', marginBottom: 6 }}>When</span>
        <ScheduleDateTimeFields
          idPrefix="post-editor"
          dateValue={dateStr}
          timeValue={timeStr}
          onDateChange={setDateStr}
          onTimeChange={setTimeStr}
          noTime={noTime}
          onNoTimeChange={(v) => {
            setNoTime(v)
            if (v) setTimeStr('')
          }}
          disabled={status === 'draft'}
        />
      </div>

      {/* Platform / account picker — one row per platform */}
      <div className="platform-picker-stack">
        <span className="label">
          Platforms
          <span className="platform-picker-hint muted">
            — toggle active platforms in Settings
          </span>
        </span>
        {platformRowLabels.map((p) => {
          const platformKey = ACCOUNT_PLATFORM_LABELS[p]
          const grpAccounts = platformKey ? accounts.filter((a) => a.platform === platformKey) : []
          const meta = platformKey ? PLATFORM_META[platformKey] : null

          return (
            <div key={p} className="platform-picker-row">
              <span className="platform-picker-row-label">
                {platformKey && <PlatformLogoImg platform={platformKey} size={20} />}
                <span className="platform-picker-row-name">{p}</span>
              </span>
              {grpAccounts.length > 0 ? (
                <div className="platform-picker-row-accounts">
                  {grpAccounts.map((acc) => (
                    <label key={acc.id} className="chip chip--account">
                      <input
                        type="checkbox"
                        checked={selectedAccountIds.includes(acc.id)}
                        onChange={() => toggleAccount(acc.id)}
                        aria-label={`${p}: ${acc.name}`}
                      />
                      <span className="chip-account-dot" style={{ background: meta!.color }} aria-hidden />
                      {acc.name}
                    </label>
                  ))}
                </div>
              ) : (
                <label className="chip chip--platform-solo">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes(p)}
                    onChange={() => togglePlatform(p)}
                    aria-label={`Include ${p}`}
                  />
                </label>
              )}
            </div>
          )
        })}
      </div>

      <label>
        <span className="label">Status</span>
        <select
          value={status}
          onChange={(e) => {
            const next = e.target.value as Status
            setStatus(next)
            if (next === 'draft') {
              setDateStr('')
              setTimeStr('')
              setNoTime(true)
            }
          }}
        >
          <option value="draft">draft</option>
          <option value="scheduled">scheduled</option>
          <option value="posted">posted</option>
        </select>
      </label>
      {status !== 'draft' && status === 'posted' && (
        <label>
          <span className="label">Live post URL</span>
          <input
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={postedUrl}
            onChange={(e) => setPostedUrl(e.target.value)}
          />
          <span className="muted small">Optional. If empty, a placeholder link is used until you add one.</span>
        </label>
      )}
      <div className="row actions">
        <button type="button" className="primary" onClick={save}>
          Save
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
