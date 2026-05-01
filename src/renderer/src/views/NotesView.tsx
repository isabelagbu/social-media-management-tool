import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { playPop } from '../utils/sound'
import Tip from '../components/Tip'
import { WORKSPACE_SYNCED_EVENT } from '../workspace/sync'

// ── Notepad tabs ──────────────────────────────────────────────────────────────
const NUM_TABS = 10
const TABS_KEY = 'smm-notepad-tabs-v2'
const ACTIVE_KEY = 'smm-notepad-active'
const NOTEPAD_DEMO_VERSION_KEY = 'smm-notepad-demo-v'
const NOTEPAD_DEMO_VERSION = 3

type TabData = { name: string; text: string }

const TAB_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

function defaultTabs(): TabData[] {
  return Array.from({ length: NUM_TABS }, (_, i) => ({ name: TAB_LABELS[i], text: '' }))
}

/** Shown when the notepad has never been saved — first install / demo. */
function demoNotepadTabs(): TabData[] {
  const tabs = defaultTabs()
  tabs[0] = {
    name: 'Main',
    text: `Theme ideas
-----------
• Behind-the-algorithm myth busting (mini-series)
• Co-host takeover Friday

Hooks to try
------------
• "Stop scrolling if you hate editing."
• "I tracked every hour for 30 days."`
  }
  tabs[1] = {
    name: 'Hooks',
    text: `Short shelf life (use soon):
- nobody: … / me: …
- "I was wrong about…" + one concrete fix`
  }
  return tabs
}

/** One-time refresh of empty notepad + stickies when demo content was updated. */
function migrateNotepadDemoIfNeeded(): void {
  try {
    if (localStorage.getItem(NOTEPAD_DEMO_VERSION_KEY) === String(NOTEPAD_DEMO_VERSION)) return
    const rawTabs = localStorage.getItem(TABS_KEY)
    const rawStick = localStorage.getItem(STICKY_NOTES_KEY)
    const tabsEmpty =
      !rawTabs ||
      (() => {
        try {
          const t = JSON.parse(rawTabs) as { text?: string }[]
          return (
            Array.isArray(t) &&
            t.length === NUM_TABS &&
            t.every((row) => !String(row?.text ?? '').trim())
          )
        } catch {
          return true
        }
      })()
    const stickEmpty = !rawStick || rawStick === '[]'
    if (tabsEmpty && stickEmpty) {
      localStorage.setItem(TABS_KEY, JSON.stringify(demoNotepadTabs()))
      localStorage.setItem(STICKY_NOTES_KEY, JSON.stringify(demoStickyNotes()))
    }
    localStorage.setItem(NOTEPAD_DEMO_VERSION_KEY, String(NOTEPAD_DEMO_VERSION))
  } catch {
    /* ignore */
  }
}

function readTabs(): TabData[] {
  migrateNotepadDemoIfNeeded()
  try {
    const raw = localStorage.getItem(TABS_KEY)
    if (!raw) return demoNotepadTabs()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length !== NUM_TABS) return defaultTabs()
    return parsed.map((t, i) => ({
      name: typeof t.name === 'string' && t.name.trim() ? t.name : TAB_LABELS[i] ?? String(i + 1),
      text: typeof t.text === 'string' ? t.text : ''
    }))
  } catch {
    return defaultTabs()
  }
}

function readActive(): number {
  try {
    const v = parseInt(localStorage.getItem(ACTIVE_KEY) ?? '0', 10)
    return Number.isFinite(v) && v >= 0 && v < NUM_TABS ? v : 0
  } catch {
    return 0
  }
}

// ── Sticky notes ──────────────────────────────────────────────────────────────
const STICKY_NOTES_KEY = 'smm-sticky-notes'

const STICKY_COLORS = [
  { bg: '#fff9c4', bar: '#f0d800' },  // yellow
  { bg: '#fce4ec', bar: '#f06292' },  // pink
  { bg: '#e3f2fd', bar: '#64b5f6' },  // blue
  { bg: '#e8f5e9', bar: '#66bb6a' },  // green
  { bg: '#f3e5f5', bar: '#ba68c8' },  // purple
  { bg: '#fff3e0', bar: '#ffa726' },  // orange
  { bg: '#e0f7fa', bar: '#26c6da' },  // teal
]

type StickyNote = {
  id: string
  colorIdx: number
  x: number
  y: number
  text: string
  zIndex: number
}

// Minimum x so stickies can't be dragged behind the collapsed sidebar
const SIDEBAR_GUARD_X = 64
// Minimum y so stickies stay below the top window edge
const SIDEBAR_GUARD_Y = 8

function demoStickyNotes(): StickyNote[] {
  return [
    {
      id: 'sticky-seed-a',
      colorIdx: 0,
      x: 120,
      y: 100,
      text: 'Film B-roll this week: coffee pour, timeline scrub, notification ping',
      zIndex: 201
    },
    {
      id: 'sticky-seed-b',
      colorIdx: 2,
      x: 420,
      y: 180,
      text: 'Ask followers: which platform gets the "long" cut first?',
      zIndex: 202
    },
    {
      id: 'sticky-seed-c',
      colorIdx: 4,
      x: 260,
      y: 320,
      text: 'Thumbnail A/B — export v2 before Tuesday',
      zIndex: 203
    }
  ]
}

function readStickyNotes(): StickyNote[] {
  migrateNotepadDemoIfNeeded()
  try {
    const raw = localStorage.getItem(STICKY_NOTES_KEY)
    if (!raw) return demoStickyNotes()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Clamp any saved positions that are behind the sidebar
    return parsed.map((n) => ({
      ...n,
      x: Math.max(SIDEBAR_GUARD_X, n.x ?? SIDEBAR_GUARD_X),
      y: Math.max(SIDEBAR_GUARD_Y, n.y ?? SIDEBAR_GUARD_Y)
    }))
  } catch {
    return []
  }
}

// Track the highest z-index across all sticky notes
let topZ = 200

// ── StickyNoteCard ────────────────────────────────────────────────────────────
function StickyNoteCard({
  note,
  onClose,
  onTextChange,
  onMove,
  onFocus
}: {
  note: StickyNote
  onClose: () => void
  onTextChange: (text: string) => void
  onMove: (x: number, y: number) => void
  onFocus: () => void
}): React.ReactElement {
  const color = STICKY_COLORS[note.colorIdx % STICKY_COLORS.length]
  const dragState = useRef<{ startX: number; startY: number; noteX: number; noteY: number } | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function handleHeaderMouseDown(e: React.MouseEvent): void {
    if ((e.target as HTMLElement).closest('.sticky-note-close, .sticky-note-confirm')) return
    e.preventDefault()
    onFocus()
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      noteX: note.x,
      noteY: note.y
    }

    function onMouseMove(ev: MouseEvent): void {
      if (!dragState.current) return
      const dx = ev.clientX - dragState.current.startX
      const dy = ev.clientY - dragState.current.startY
      onMove(
        Math.max(SIDEBAR_GUARD_X, dragState.current.noteX + dx),
        Math.max(SIDEBAR_GUARD_Y, dragState.current.noteY + dy)
      )
    }

    function onMouseUp(): void {
      dragState.current = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return createPortal(
    <div
      className="sticky-note"
      style={
        {
          left: note.x,
          top: note.y,
          zIndex: note.zIndex,
          '--sticky-bg': color.bg,
          '--sticky-bar': color.bar
        } as React.CSSProperties
      }
      onMouseDown={onFocus}
    >
      <div className="sticky-note-header" onMouseDown={handleHeaderMouseDown}>
        <span className="sticky-note-grip" aria-hidden>
          ⠿
        </span>
        <button
          type="button"
          className="sticky-note-close"
          data-silent
          onClick={() => setConfirmingDelete(true)}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label="Delete sticky note"
        >
          ×
        </button>
      </div>

      {confirmingDelete && (
        <div className="sticky-note-confirm" onMouseDown={(e) => e.stopPropagation()}>
          <span className="sticky-note-confirm-label">Delete this note?</span>
          <div className="sticky-note-confirm-actions">
            <button
              type="button"
              className="sticky-note-confirm-yes"
              data-silent
              onClick={onClose}
            >
              Yes
            </button>
            <button
              type="button"
              className="sticky-note-confirm-no"
              data-silent
              onClick={() => setConfirmingDelete(false)}
            >
              No
            </button>
          </div>
        </div>
      )}

      <textarea
        className="sticky-note-body"
        value={note.text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Write something…"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onFocus}
      />
    </div>,
    document.body
  )
}

// ── NotesView ─────────────────────────────────────────────────────────────────
export default function NotesView(): React.ReactElement {
  const [tabs, setTabs] = useState<TabData[]>(readTabs)
  const [active, setActive] = useState<number>(readActive)
  const [editingTab, setEditingTab] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const renameRef = useRef<HTMLInputElement | null>(null)

  const [stickies, setStickies] = useState<StickyNote[]>(() => {
    const notes = readStickyNotes()
    // Sync topZ so new notes stack above existing ones
    if (notes.length > 0) {
      topZ = Math.max(topZ, ...notes.map((n) => n.zIndex))
    }
    return notes
  })

  useEffect(() => {
    function onWorkspaceSynced(): void {
      setTabs(readTabs())
      setActive(readActive())
      const notes = readStickyNotes()
      if (notes.length > 0) {
        topZ = Math.max(topZ, ...notes.map((n) => n.zIndex))
      }
      setStickies(notes)
    }
    window.addEventListener(WORKSPACE_SYNCED_EVENT, onWorkspaceSynced)
    return () => window.removeEventListener(WORKSPACE_SYNCED_EVENT, onWorkspaceSynced)
  }, [])

  // Persist tabs on change
  useEffect(() => {
    try {
      localStorage.setItem(TABS_KEY, JSON.stringify(tabs))
    } catch { /* ignore */ }
  }, [tabs])

  // Persist active tab
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_KEY, String(active))
    } catch { /* ignore */ }
  }, [active])

  // Persist sticky notes on change
  useEffect(() => {
    try {
      localStorage.setItem(STICKY_NOTES_KEY, JSON.stringify(stickies))
    } catch { /* ignore */ }
  }, [stickies])

  // Focus rename input when opened
  useEffect(() => {
    if (editingTab !== null) renameRef.current?.select()
  }, [editingTab])

  function updateText(text: string): void {
    setTabs((prev) => prev.map((t, i) => (i === active ? { ...t, text } : t)))
  }

  function startRename(idx: number): void {
    setEditingTab(idx)
    setEditingName(tabs[idx].name)
  }

  function commitRename(): void {
    if (editingTab === null) return
    const name = editingName.trim() || TAB_LABELS[editingTab] || String(editingTab + 1)
    setTabs((prev) => prev.map((t, i) => (i === editingTab ? { ...t, name } : t)))
    setEditingTab(null)
  }

  async function copyAll(): Promise<void> {
    await window.api.copyText(tabs[active].text)
  }

  function clearPad(): void {
    const t = tabs[active].text
    if (t.trim() !== '' && !window.confirm('Clear this tab?')) return
    setTabs((prev) => prev.map((tab, i) => (i === active ? { ...tab, text: '' } : tab)))
  }

  // ── Sticky note actions ───────────────────────────────────────────────────
  function addSticky(): void {
    playPop()
    topZ++
    const colorIdx = Math.floor(Math.random() * STICKY_COLORS.length)
    const offset = (stickies.length % 10) * 28
    setStickies((prev) => [
      ...prev,
      {
        id: `sticky-${Date.now()}`,
        colorIdx,
        x: 160 + offset,
        y: 140 + offset,
        text: '',
        zIndex: topZ
      }
    ])
  }

  function removeSticky(id: string): void {
    setStickies((prev) => prev.filter((s) => s.id !== id))
  }

  function updateStickyText(id: string, text: string): void {
    setStickies((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)))
  }

  function moveSticky(id: string, x: number, y: number): void {
    setStickies((prev) => prev.map((s) => (s.id === id ? { ...s, x, y } : s)))
  }

  function bringToFront(id: string): void {
    topZ++
    setStickies((prev) => prev.map((s) => (s.id === id ? { ...s, zIndex: topZ } : s)))
  }

  const currentText = tabs[active]?.text ?? ''

  return (
    <div className="page notepad-page">
      <header className="page-header notepad-header">
        <div>
          <h1>Notepad</h1>
          <p className="sub">A place to brainstorm, jot ideas, and draft freely — saved automatically.</p>
          <Tip>Double-click a tab to rename it · Use + Sticky to spawn floating colour-coded sticky notes · Drag sticky notes anywhere on screen</Tip>
        </div>
        <div className="notepad-actions">
          <button type="button" onClick={copyAll}>
            Copy all
          </button>
          <button type="button" className="ghost" onClick={clearPad}>
            Clear
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="notepad-tabs" role="tablist" aria-label="Notepad tabs">
        {tabs.map((tab, idx) => (
          <button
            key={idx}
            type="button"
            role="tab"
            aria-selected={active === idx}
            className={`notepad-tab${active === idx ? ' notepad-tab--active' : ''}`}
            onClick={() => {
              setActive(idx)
              setEditingTab(null)
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              startRename(idx)
            }}
            title={`${tab.name} — double-click to rename`}
          >
            {editingTab === idx ? (
              <input
                ref={renameRef}
                className="notepad-tab-rename"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') setEditingTab(null)
                  e.stopPropagation()
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="notepad-tab-name">{tab.name}</span>
            )}
          </button>
        ))}
      </div>

      <textarea
        className="notepad-editor"
        placeholder="Jot ideas, hooks, hashtags, reminders…"
        value={currentText}
        onChange={(e) => updateText(e.target.value)}
        spellCheck
        aria-label={`${tabs[active]?.name ?? 'Notepad'} scratch notes`}
      />

      {/* Sticky notes — rendered into document.body via portals */}
      {stickies.map((note) => (
        <StickyNoteCard
          key={note.id}
          note={note}
          onClose={() => removeSticky(note.id)}
          onTextChange={(text) => updateStickyText(note.id, text)}
          onMove={(x, y) => moveSticky(note.id, x, y)}
          onFocus={() => bringToFront(note.id)}
        />
      ))}

      {/* Floating action button */}
      {createPortal(
        <button
          type="button"
          className="primary sticky-fab"
          data-silent
          onClick={addSticky}
          aria-label="Add sticky note"
          title="Add sticky note"
        >
          + Sticky
        </button>,
        document.body
      )}
    </div>
  )
}
