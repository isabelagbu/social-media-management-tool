import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AccountsProvider } from './accounts/context'
import { playPop } from './utils/sound'
import {
  applyWorkspaceHydrationPayload,
  buildWorkspaceSnapshot,
  installWorkspaceLocalStorageSync
} from './workspace/sync'
import './main.css'

installWorkspaceLocalStorageSync()

// Global click sound — fires for buttons/interactive elements but not nav (nav uses 'nav' variant)
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  const el = target.closest('button, [role="button"], label')
  if (!el) return
  if (el.closest('.nav-item')) return      // nav uses its own sound
  if (el.hasAttribute('data-silent')) return // element plays its own sound
  playPop()
}, { capture: true })

function Root(): React.ReactElement {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const h = await window.api.workspaceReadHydration()
        applyWorkspaceHydrationPayload(h, { notify: false })
        await window.api.workspaceReportSnapshot(buildWorkspaceSnapshot())
      } catch {
        /* ignore */
      }
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return window.api.onDriveWorkspaceChange((payload) => {
      applyWorkspaceHydrationPayload(payload)
    })
  }, [])

  if (!ready) return <></>

  return (
    <AccountsProvider>
      <App />
    </AccountsProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
