import { useEffect, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAccounts } from '../accounts/context'
import { PLATFORM_META, PLATFORMS, type Platform } from '../accounts/types'
import { ACCENT_PRESETS, type AccentPresetId, type AppTheme } from '../theme'
import { isSoundEnabled, setSoundEnabled } from '../utils/sound'
import { isHintsEnabled, setHintsEnabled } from '../utils/hints'
import { isRemindersEnabled, setRemindersEnabled } from '../utils/reminders'
import { isInAppAccountPreviewEnabled, setInAppAccountPreviewEnabled } from '../utils/accountsView'
import { PLATFORM_OPTIONS } from '../posts/types'
import { getEnabledPlatformFormLabels, setEnabledPlatformFormLabels } from '../utils/enabledPlatforms'
import PlatformLogoImg from '../components/PlatformLogoImg'
import { WORKSPACE_SYNCED_EVENT } from '../workspace/sync'

type DriveSyncStatus = {
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

const BANNER_ENABLED_KEY = 'smm-dash-banner-enabled'
export function isBannerEnabled(): boolean {
  try {
    const v = localStorage.getItem(BANNER_ENABLED_KEY)
    return v === null ? true : v === 'true'
  } catch { return true }
}
function setBannerEnabled(on: boolean): void {
  try { localStorage.setItem(BANNER_ENABLED_KEY, String(on)) } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('smm-banner-change', { detail: on }))
}

const APPEARANCE: { id: AppTheme; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' }
]

export default function SettingsView({
  theme,
  accent,
  onThemeChange,
  onAccentChange
}: {
  theme: AppTheme
  accent: AccentPresetId
  onThemeChange: (theme: AppTheme) => void
  onAccentChange: (accent: AccentPresetId) => void
}): React.ReactElement {
  const { accounts, addAccount, updateAccount, removeAccount } = useAccounts()
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled())
  const [hintsOn, setHintsOn] = useState(() => isHintsEnabled())
  const [remindersOn, setRemindersOn] = useState(() => isRemindersEnabled())
  const [bannerOn, setBannerOn] = useState(() => isBannerEnabled())
  const [accountsPreviewOn, setAccountsPreviewOn] = useState(() => isInAppAccountPreviewEnabled())
  const [formPlatformEnabled, setFormPlatformEnabled] = useState<Set<string>>(() => new Set(getEnabledPlatformFormLabels()))

  useEffect(() => {
    function onWorkspaceSynced(): void {
      setSoundOn(isSoundEnabled())
      setHintsOn(isHintsEnabled())
      setRemindersOn(isRemindersEnabled())
      setBannerOn(isBannerEnabled())
      setAccountsPreviewOn(isInAppAccountPreviewEnabled())
      setFormPlatformEnabled(new Set(getEnabledPlatformFormLabels()))
    }
    window.addEventListener(WORKSPACE_SYNCED_EVENT, onWorkspaceSynced)
    return () => window.removeEventListener(WORKSPACE_SYNCED_EVENT, onWorkspaceSynced)
  }, [])

  function toggleSound(): void {
    const next = !soundOn
    setSoundOn(next)
    setSoundEnabled(next)
  }

  function toggleHints(): void {
    const next = !hintsOn
    setHintsOn(next)
    setHintsEnabled(next)
  }

  function toggleReminders(): void {
    const next = !remindersOn
    setRemindersOn(next)
    setRemindersEnabled(next)
  }

  function toggleBanner(): void {
    const next = !bannerOn
    setBannerOn(next)
    setBannerEnabled(next)
  }

  function toggleAccountsPreview(): void {
    const next = !accountsPreviewOn
    setAccountsPreviewOn(next)
    setInAppAccountPreviewEnabled(next)
  }

  function toggleFormPlatform(label: (typeof PLATFORM_OPTIONS)[number]): void {
    const next = new Set(formPlatformEnabled)
    if (next.has(label)) {
      if (next.size <= 1) return
      next.delete(label)
    } else {
      next.add(label)
    }
    setEnabledPlatformFormLabels([...next] as (typeof PLATFORM_OPTIONS)[number][])
    setFormPlatformEnabled(next)
  }

  const [addingFor, setAddingFor] = useState<Platform | null>(null)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editUrl, setEditUrl] = useState('')

  const [driveStatus, setDriveStatus] = useState<DriveSyncStatus | null>(null)
  const [driveBusy, setDriveBusy] = useState<'connect' | 'disconnect' | 'sync' | null>(null)
  const [driveActionError, setDriveActionError] = useState<string | null>(null)
  const [confirmDriveDisconnect, setConfirmDriveDisconnect] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      const status = await window.api.driveGetStatus()
      if (!alive) return
      setDriveStatus(status)
    })()
    const off = window.api.onDriveStatusChange((partial) => {
      setDriveStatus((prev) => (prev ? { ...prev, ...partial } : prev))
    })
    return () => {
      alive = false
      off()
    }
  }, [])

  async function connectDrive(): Promise<void> {
    setDriveBusy('connect')
    setDriveActionError(null)
    try {
      const status = await window.api.driveConnect()
      setDriveStatus(status)
    } catch (err) {
      setDriveActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setDriveBusy(null)
    }
  }

  async function disconnectDrive(): Promise<void> {
    setDriveBusy('disconnect')
    setDriveActionError(null)
    try {
      const status = await window.api.driveDisconnect()
      setDriveStatus(status)
    } catch (err) {
      setDriveActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setDriveBusy(null)
      setConfirmDriveDisconnect(false)
    }
  }

  async function syncNow(): Promise<void> {
    setDriveBusy('sync')
    setDriveActionError(null)
    try {
      const status = await window.api.driveSyncNow()
      setDriveStatus(status)
    } catch (err) {
      setDriveActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setDriveBusy(null)
    }
  }

  function formatLastSync(ts: number | null): string {
    if (!ts) return 'Never'
    const d = new Date(ts)
    const sameDay = new Date().toDateString() === d.toDateString()
    return sameDay
      ? `Today at ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  function openAdd(platform: Platform): void {
    setAddingFor(platform)
    setNewName('')
    setNewUrl('')
    setEditingId(null)
  }

  function submitAdd(): void {
    if (!addingFor || !newName.trim()) return
    addAccount(
      addingFor,
      newName.trim(),
      newUrl.trim() || PLATFORM_META[addingFor].defaultUrl
    )
    setAddingFor(null)
    setNewName('')
    setNewUrl('')
  }

  function openEdit(id: string, name: string, url: string): void {
    setEditingId(id)
    setEditName(name)
    setEditUrl(url)
    setAddingFor(null)
  }

  function submitEdit(): void {
    if (!editingId) return
    updateAccount(editingId, { name: editName.trim(), url: editUrl.trim() })
    setEditingId(null)
  }

  function openAccountInBrowser(url: string): void {
    const u = url.trim()
    if (!u) return
    void window.api.openExternalUrl(u)
  }

  return (
    <div className="page settings-page">
      <header className="page-header">
        <h1>Settings</h1>
        <p className="sub">Theme, behaviour, and where you post — then sign in to each platform account.</p>
      </header>

      <div className="settings-chapter" aria-labelledby="settings-chapter-theming">
        <h2 id="settings-chapter-theming" className="settings-chapter-title">
          Theming
        </h2>

        <section className="settings-section card settings-section--compact" aria-labelledby="settings-appearance-heading">
          <h3 id="settings-appearance-heading" className="settings-section-title">
            Color mode
          </h3>
          <p className="muted small settings-section-lead">Light, dark, or system.</p>
          <div className="appearance-toggle" role="group" aria-label="Color mode">
            {APPEARANCE.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`appearance-pill${theme === opt.id ? ' active' : ''}`}
                onClick={() => onThemeChange(opt.id)}
                aria-pressed={theme === opt.id}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section card" aria-labelledby="settings-accent-heading">
          <h3 id="settings-accent-heading" className="settings-section-title">
            Primary color
          </h3>
          <p className="muted small settings-section-lead">
            Accent for buttons, highlights, and focus rings.
          </p>
          <div className="accent-picker" role="group" aria-label="Primary color">
            {ACCENT_PRESETS.map((p) => {
              const selected = accent === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`accent-circle${selected ? ' selected' : ''}`}
                  style={{ backgroundColor: p.hex }}
                  onClick={() => onAccentChange(p.id)}
                  aria-pressed={selected}
                  aria-label={p.label}
                  title={p.label}
                />
              )
            })}
          </div>
          <p className="accent-picker-caption muted small">
            {ACCENT_PRESETS.find((p) => p.id === accent)?.label ?? accent}
          </p>
        </section>
      </div>

      <div className="settings-chapter" aria-labelledby="settings-chapter-feedback">
        <h2 id="settings-chapter-feedback" className="settings-chapter-title">
          Sound, hints, notifications &amp; home
        </h2>

        <section className="settings-section card settings-section--compact" aria-labelledby="settings-sound-heading">
        <h3 id="settings-sound-heading" className="settings-section-title">
          Sound
        </h3>
        <p className="muted small settings-section-lead">
          Play a pop sound on clicks and navigation.
        </p>
        <label className="settings-toggle-row">
          <span className="settings-toggle-label">Click sounds</span>
          <button
            type="button"
            role="switch"
            aria-checked={soundOn}
            className={`settings-toggle${soundOn ? ' settings-toggle--on' : ''}`}
            onClick={toggleSound}
            aria-label="Toggle click sounds"
          >
            <span className="settings-toggle-thumb" />
          </button>
        </label>
      </section>

        <section className="settings-section card settings-section--compact" aria-labelledby="settings-hints-heading">
        <h3 id="settings-hints-heading" className="settings-section-title">
          Hints
        </h3>
        <p className="muted small settings-section-lead">
          Show usage tip cards throughout the app.
        </p>
        <label className="settings-toggle-row">
          <span className="settings-toggle-label">Hint cards</span>
          <button
            type="button"
            role="switch"
            aria-checked={hintsOn}
            className={`settings-toggle${hintsOn ? ' settings-toggle--on' : ''}`}
            onClick={toggleHints}
            aria-label="Toggle hint cards"
          >
            <span className="settings-toggle-thumb" />
          </button>
        </label>
      </section>

        <section className="settings-section card settings-section--compact" aria-labelledby="settings-reminders-heading">
        <h3 id="settings-reminders-heading" className="settings-section-title">
          Reminders
        </h3>
        <p className="muted small settings-section-lead">
          Get a system notification when a scheduled post is due.
        </p>
        <label className="settings-toggle-row">
          <span className="settings-toggle-label">Post reminders</span>
          <button
            type="button"
            role="switch"
            aria-checked={remindersOn}
            className={`settings-toggle${remindersOn ? ' settings-toggle--on' : ''}`}
            onClick={toggleReminders}
            aria-label="Toggle post reminders"
          >
            <span className="settings-toggle-thumb" />
          </button>
        </label>
        <div className="settings-reminder-test">
          <button
            type="button"
            className="ghost small"
            disabled={!remindersOn}
            onClick={() => {
              const api = (window as Window & { api?: { notify?: (t: string, b: string) => void } }).api
              api?.notify?.('⏰ Test — Ready Set Post!', 'Notifications are working.')
            }}
          >
            Send test notification
          </button>
          {!remindersOn && <span className="muted small">Enable reminders to test</span>}
        </div>
        </section>

        <section className="settings-section card settings-section--compact" aria-labelledby="settings-dashboard-heading">
          <h3 id="settings-dashboard-heading" className="settings-section-title">
            Dashboard
          </h3>
          <p className="muted small settings-section-lead">Show or hide the cover photo on your home dashboard.</p>
          <label className="settings-toggle-row">
            <span className="settings-toggle-label">Cover photo</span>
            <button
              type="button"
              role="switch"
              aria-checked={bannerOn}
              className={`settings-toggle${bannerOn ? ' settings-toggle--on' : ''}`}
              onClick={toggleBanner}
              aria-label="Toggle dashboard cover photo"
            >
              <span className="settings-toggle-thumb" />
            </button>
          </label>
        </section>
      </div>

      <div className="settings-chapter" aria-labelledby="settings-chapter-platforms-accounts">
        <h2 id="settings-chapter-platforms-accounts" className="settings-chapter-title">
          Platforms and accounts
        </h2>
        <p className="settings-chapter-lead muted small">
          Choose which platforms show when you create or filter posts, then add account sign-ins to open in the
          Accounts tab.
        </p>

        <section className="settings-section card settings-section--compact" aria-labelledby="settings-accounts-tab-heading">
          <h3 id="settings-accounts-tab-heading" className="settings-section-title">
            In-app account previews
          </h3>
          <p className="muted small settings-section-lead">
            Use embedded previews in the Accounts page, or open profiles in your browser only.
          </p>
          <label className="settings-toggle-row">
            <span className="settings-toggle-label">Enable in-app account previews</span>
            <button
              type="button"
              role="switch"
              aria-checked={accountsPreviewOn}
              className={`settings-toggle${accountsPreviewOn ? ' settings-toggle--on' : ''}`}
              onClick={toggleAccountsPreview}
              aria-label="Toggle in-app account previews"
            >
              <span className="settings-toggle-thumb" />
            </button>
          </label>
        </section>

        <section
          className="settings-section card settings-section--compact"
          aria-labelledby="settings-form-platforms-heading"
        >
        <h3 id="settings-form-platforms-heading" className="settings-section-title">
          Active platforms
        </h3>
        <p className="muted small settings-section-lead">
          Turn off platforms you do not use — at least one must stay on.
        </p>
        <ul className="settings-form-platform-list" role="list">
          {PLATFORM_OPTIONS.map((label) => {
            const on = formPlatformEnabled.has(label)
            const only = formPlatformEnabled.size === 1 && on
            return (
              <li key={label}>
                <label className="settings-toggle-row settings-form-platform-row">
                  <span className="settings-toggle-label">{label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    className={`settings-toggle${on ? ' settings-toggle--on' : ''}`}
                    disabled={only}
                    onClick={() => toggleFormPlatform(label)}
                    title={only ? 'At least one platform must stay enabled' : undefined}
                    aria-label={only ? `${label} (required)` : `Show ${label} in post forms`}
                  >
                    <span className="settings-toggle-thumb" />
                  </button>
                </label>
              </li>
            )
          })}
        </ul>
        </section>

        <section className="settings-section card" aria-label="Platform accounts">
        <h3 className="settings-section-title" id="settings-accounts-list-heading">
          Platform accounts
        </h3>
        <p className="muted small settings-section-lead">
          Add handles and URLs for each platform you use, then use + Add account on every row. Open a profile from the
          Accounts tab.
        </p>

        {PLATFORMS.map((platform) => {
          const meta = PLATFORM_META[platform]
          const platformAccounts = accounts.filter((a) => a.platform === platform)
          const isAdding = addingFor === platform

          return (
            <div key={platform} className="settings-platform-group">
              <div className="settings-platform-header">
                <PlatformLogoImg platform={platform} size={18} />
                <span className="settings-platform-label">{meta.label}</span>
                <button
                  type="button"
                  className="settings-add-btn"
                  onClick={() => openAdd(platform)}
                  aria-label={`Add ${meta.label} account`}
                >
                  + Add account
                </button>
              </div>

              {platformAccounts.length > 0 && (
                <ul className="settings-account-list">
                  {platformAccounts.map((acc) => (
                    <li key={acc.id} className="settings-account-item">
                      {editingId === acc.id ? (
                        <div className="settings-account-edit-form">
                          <input
                            type="text"
                            placeholder="Handle (e.g. @mypage)"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            autoFocus
                          />
                          <input
                            type="url"
                            placeholder={meta.defaultUrl}
                            value={editUrl}
                            onChange={(e) => setEditUrl(e.target.value)}
                          />
                          <div className="settings-account-edit-actions">
                            <button
                              type="button"
                              className="btn btn--primary btn--sm"
                              onClick={submitEdit}
                              disabled={!editName.trim()}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="settings-account-name">{acc.name}</span>
                          <span className="settings-account-url muted small">{acc.url || meta.defaultUrl}</span>
                          <div className="settings-account-actions">
                            <button
                              type="button"
                              className="settings-account-btn"
                              onClick={() => openAccountInBrowser(acc.url || meta.defaultUrl)}
                              aria-label={`Open ${acc.name} in browser`}
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              className="settings-account-btn"
                              onClick={() => openEdit(acc.id, acc.name, acc.url)}
                              aria-label={`Edit ${acc.name}`}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="settings-account-btn settings-account-btn--danger"
                              onClick={() => setConfirmRemoveId(acc.id)}
                              aria-label={`Remove ${acc.name}`}
                            >
                              Remove
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {isAdding && (
                <div className="settings-account-add-form">
                  <input
                    type="text"
                    placeholder="Handle (e.g. @mypage)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
                  />
                  <input
                    type="url"
                    placeholder={meta.defaultUrl}
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
                  />
                  <div className="settings-account-add-actions">
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={submitAdd}
                      disabled={!newName.trim()}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setAddingFor(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {platformAccounts.length === 0 && !isAdding && (
                <p className="settings-platform-empty muted small">No accounts added yet.</p>
              )}
            </div>
          )
        })}
      </section>
      </div>

      <div className="settings-chapter settings-chapter--last" aria-labelledby="settings-chapter-workspace">
        <h2 id="settings-chapter-workspace" className="settings-chapter-title">
          Storage
        </h2>

        <section
          className="settings-section card settings-section--compact"
          aria-labelledby="settings-drive-heading"
        >
          <h3 id="settings-drive-heading" className="settings-section-title">
            Google Drive sync
          </h3>
          <p className="muted small settings-section-lead">
            Store your posts and notes in your own Google Drive folder. Ready Set Post creates a
            <strong> Ready Set Post </strong>
            folder in your Drive and keeps it in sync automatically across devices.
          </p>

          {!driveStatus ? (
            <p className="muted small">Loading sync status…</p>
          ) : (
            <>
              {!driveStatus.connected && (
                <div className="drive-actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={driveBusy === 'connect' || !driveStatus.credentialsManaged}
                    onClick={() => void connectDrive()}
                  >
                    {driveBusy === 'connect' ? 'Opening Google…' : 'Connect Google Drive'}
                  </button>
                  <span className="muted small drive-actions-hint">
                    {driveStatus?.credentialsManaged
                      ? 'Opens your browser to sign in using app-managed credentials.'
                      : 'Google Drive credentials are not configured for this build.'}
                  </span>
                </div>
              )}

              {driveStatus.connected && (
                <>
                  <div className="drive-status-grid">
                    <div className="drive-status-row">
                      <span className="muted small">Account</span>
                      <span className="drive-status-value">
                        {driveStatus.email ?? 'Connected'}
                      </span>
                    </div>
                    <div className="drive-status-row">
                      <span className="muted small">Last sync</span>
                      <span className="drive-status-value">
                        {driveStatus.syncing ? 'Syncing now…' : formatLastSync(driveStatus.lastSyncedAt)}
                      </span>
                    </div>
                    <div className="drive-status-row">
                      <span className="muted small">Pending changes</span>
                      <span className="drive-status-value">
                        {driveStatus.hasPendingChanges ? 'Queued for upload' : 'None'}
                      </span>
                    </div>
                  </div>
                  <div className="drive-actions">
                    <button
                      type="button"
                      className="ghost"
                      disabled={driveBusy === 'sync' || driveStatus.syncing}
                      onClick={() => void syncNow()}
                    >
                      {driveBusy === 'sync' || driveStatus.syncing ? 'Syncing…' : 'Sync now'}
                    </button>
                    <button
                      type="button"
                      className="ghost danger"
                      disabled={driveBusy === 'disconnect'}
                      onClick={() => setConfirmDriveDisconnect(true)}
                    >
                      Disconnect
                    </button>
                  </div>
                </>
              )}

              {(driveActionError || driveStatus.lastError) && (
                <p className="drive-error muted small">
                  <strong>Error:</strong> {driveActionError ?? driveStatus.lastError}
                </p>
              )}
            </>
          )}
        </section>

      </div>

      <footer className="settings-footer">
        Designed &amp; developed by Isabel Agbu
      </footer>

      {confirmRemoveId && (() => {
        const acc = accounts.find((a) => a.id === confirmRemoveId)
        return (
          <ConfirmDialog
            title="Remove account?"
            message={acc ? `"${acc.name}" will be removed from the app.` : 'This account will be removed.'}
            confirmLabel="Remove"
            onConfirm={() => { removeAccount(confirmRemoveId); setConfirmRemoveId(null) }}
            onCancel={() => setConfirmRemoveId(null)}
          />
        )
      })()}

      {confirmDriveDisconnect && (
        <ConfirmDialog
          title="Disconnect Google Drive?"
          message="Sync will stop. Your posts and notes stay on this device, and the files in your Drive folder are not deleted."
          confirmLabel="Disconnect"
          onConfirm={() => void disconnectDrive()}
          onCancel={() => setConfirmDriveDisconnect(false)}
        />
      )}

    </div>
  )
}
