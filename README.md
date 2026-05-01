# Ready Set Post!

A desktop app for planning, scheduling, and managing social media content — built with Electron, React, and TypeScript.

Designed & developed by Isabel Agbu.

---

## Features

### Dashboard
- Customisable greeting (double-click to edit)
- Uploadable cover photo banner with built-in crop tool
- At-a-glance stat cards: Drafts, Scheduled, Posted, Overdue, Total
- "Next up" and "Recent drafts" side-by-side for quick access
- Recent posts grid with YouTube/TikTok thumbnails and platform colours
- Overdue post warning with one-click calendar link
- Contextual usage hint cards

### Content Management
- Create posts with a title, body, platform selection, and optional scheduled date
- Three sections: **Drafts**, **Content** (scheduled + posted)
- Filter by platform or account, search by keyword, sort by newest or oldest
- Edit posts inline or delete with a confirmation prompt
- Mark posts as posted directly from the content card

### Calendar View
- Monthly calendar showing all scheduled posts per day
- Hover over a day with posts to see a bubble of post titles
- Click any day to open a panel for viewing, creating, or editing posts
- **Drag-to-reschedule** — drag a post card onto a new date to move it
- Cards become translucent while dragging for clear visual feedback

### Detailed Notes View
- Full-screen overlay for script, hashtags, caption, and other notes
- All fields auto-save continuously
- Post metadata (status, date, platform pills) shown inline
- Edit post details without leaving the view
- Delete post from the toolbar with a confirmation prompt
- Live post preview: shows YouTube or TikTok thumbnail for posted items

### Notepad
- 10 persistent tabs (A–J) for free-form scratch notes
- Double-click any tab to rename it
- **Sticky notes** — spawn draggable, colour-coded sticky notes anywhere on screen
  - Six colour themes (yellow, green, pink, purple, orange, teal)
  - Drag freely; constrained so they never overlap the sidebar
  - Confirmation bubble before deletion, styled to match the note colour
  - Scrollbar colour matches each sticky note
- All content saved automatically

### Accounts
- Add multiple accounts per platform (TikTok, Instagram, YouTube, LinkedIn, X)
- Each account gets its own embedded browser tab
- Back, forward, and refresh controls per tab
- Loading bar and animated indicator while pages load
- User-agent spoofing for full compatibility with LinkedIn and X

### Reminders
- System notification when a scheduled post becomes due
- Check runs every 60 seconds in the background
- Send test notification from Settings to verify macOS permissions
- Fully toggleable from Settings

### Onboarding
- First-launch onboarding flow walks through core features
- Dismisses permanently once completed

### Settings
- **Appearance** — Light, Dark, or System theme
- **Primary colour** — Rose, Amber, Forest, Ocean, Violet, Pearl, Onyx
- **Sound** — toggle click and navigation sounds on or off
- **Hints** — show or hide contextual tip cards throughout the app
- **Reminders** — enable/disable post-due notifications + test button
- **Dashboard** — toggle cover photo banner on or off
- **Accounts** — add, edit, or remove accounts per platform
- **Google Drive Sync** — connect/disconnect, manual sync, sync status and pending-change visibility

### Cloud Sync
- Google OAuth connection from Settings
- Auto-sync for posts (`content-store.json`) and scratchpad (`scratchpad.json`)
- Workspace mirror (`workspace.json`) syncs key local preferences across devices:
  - accounts and account-preview toggle
  - onboarding completion
  - notepad tabs, active tab, demo version, and sticky notes
  - dashboard greeting and banner image + banner enabled toggle
  - reminders, hints, enabled form platforms, content section memory
  - theme, accent, and sound preference
- Conflict handling:
  - posts merge by post `id` + latest `updatedAt`
  - workspace merges per key using latest timestamp
- Notes:
  - OAuth tokens remain device-local (each device connects once)
  - synced data is cached locally for offline use and later upload

### Sound Effects
- Subtle pop on every button click and navigation
- Single pop when scheduling a post or creating a sticky note
- Triple pop when marking a post as posted
- Fully toggleable from Settings

### Usage Hints
- Contextual tip cards in every main view
- Hint cards can be hidden globally from Settings without reloading

---

## Platforms Supported

| Platform  | Accounts | Browser Tab | Pills |
|-----------|----------|-------------|-------|
| Instagram | ✓ | ✓ | ✓ |
| TikTok    | ✓ | ✓ | ✓ |
| YouTube   | ✓ | ✓ | ✓ |
| X         | ✓ | ✓ | ✓ |
| LinkedIn  | ✓ | ✓ | ✓ |

---

## Tech Stack

- **Electron** — desktop shell, file-system storage, native notifications, theme integration
- **React 19** — UI and component state
- **TypeScript** — end-to-end type safety
- **Vite / electron-vite** — fast dev builds and HMR
- **CSS custom properties + `color-mix()`** — dynamic theming and accent colours
- **HTML5 Drag and Drop API** — calendar rescheduling and sticky note dragging
- **react-image-crop** — banner photo cropping
- **Web Audio / HTML Audio** — sound effects
- **Electron `Notification`** — native macOS reminders
- **Google Drive API** — cloud file sync for posts, scratchpad, and workspace preferences
- **localStorage** — renderer cache and UI state, mirrored into workspace sync keys
- **Electron `<webview>`** — embedded social platform browsers

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Install

```bash
npm install
```

### Configure Google Drive credentials (dev)

```bash
cp .env.example .env.local
```

Then set values in `.env.local`:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Run in development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Type check

```bash
npm run typecheck
```

---

## Project Structure

```
src/
├── main/               # Electron main process
│   ├── index.ts        # App setup, IPC handlers, file storage, notifications
│   └── seed-data.ts    # Default posts shown on first launch
├── preload/            # Context bridge (store, clipboard, notes, theme, notify)
└── renderer/src/
    ├── App.tsx          # Shell layout, navigation, reminders hook
    ├── main.tsx         # React entry, global sound listener
    ├── main.css         # All styles
    ├── theme.ts         # Theme + accent preset definitions
    ├── accounts/        # AccountsContext, types, localStorage helpers
    ├── components/      # Shared UI components
    │   ├── BannerCropModal.tsx
    │   ├── BrandLogo.tsx
    │   ├── ConfirmDialog.tsx
    │   ├── ScheduleDateTimeFields.tsx
    │   ├── OnboardingModal.tsx
    │   ├── PostContentNotesEditor.tsx
    │   ├── PostCreateForm.tsx
    │   ├── PostCreateModal.tsx
    │   ├── PostEditorForm.tsx
    │   ├── PostLivePreview.tsx
    │   ├── PostNotesFullView.tsx
    │   ├── PostPills.tsx
    │   └── Tip.tsx
    ├── hooks/
    │   └── useReminders.ts
    ├── posts/           # Post type, parsing, platform options
    ├── utils/           # sound.ts, hints.ts, reminders.ts
    └── views/
        ├── AccountsView.tsx
        ├── CalendarView.tsx
        ├── ContentView.tsx
        ├── DashboardView.tsx
        ├── NotesView.tsx
        └── SettingsView.tsx
```

---

## Data Storage

Runtime data is stored in Electron's `userData` directory and mirrored to Google Drive when connected:

- `content-store.json` — posts
- `scratchpad.json` — notes scratchpad
- `workspace.json` — synced preference/localStorage mirror for cross-device continuity

Renderer state still uses `localStorage` for immediate reads, then hydrates/applies updates from synced workspace data.
