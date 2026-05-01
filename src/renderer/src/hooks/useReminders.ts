import { useEffect, useRef } from 'react'
import type { Post } from '../posts/types'
import { isRemindersEnabled, REMINDERS_CHANGE_EVENT } from '../utils/reminders'
import { WORKSPACE_SYNCED_EVENT } from '../workspace/sync'

const CHECK_INTERVAL_MS = 60_000 // check every minute
const WINDOW_MS = CHECK_INTERVAL_MS

export function useReminders(posts: Post[]): void {
  const notifiedIds = useRef<Set<string>>(new Set())
  const enabledRef = useRef(isRemindersEnabled())

  // Keep enabledRef in sync with the settings toggle
  useEffect(() => {
    function onchange(e: Event): void {
      enabledRef.current = (e as CustomEvent<boolean>).detail
    }
    window.addEventListener(REMINDERS_CHANGE_EVENT, onchange)
    return () => window.removeEventListener(REMINDERS_CHANGE_EVENT, onchange)
  }, [])

  useEffect(() => {
    function onWorkspaceSynced(): void {
      enabledRef.current = isRemindersEnabled()
    }
    window.addEventListener(WORKSPACE_SYNCED_EVENT, onWorkspaceSynced)
    return () => window.removeEventListener(WORKSPACE_SYNCED_EVENT, onWorkspaceSynced)
  }, [])

  // Keep a stable ref to posts so the interval doesn't need to re-register
  const postsRef = useRef(posts)
  useEffect(() => { postsRef.current = posts }, [posts])

  useEffect(() => {
    function check(): void {
      if (!enabledRef.current) return
      const now = Date.now()

      for (const post of postsRef.current) {
        if (post.status !== 'scheduled' || !post.scheduledAt) continue
        if (notifiedIds.current.has(post.id)) continue

        const t = new Date(post.scheduledAt).getTime()
        // Fire if the post was due within the last check window
        if (t > now - WINDOW_MS && t <= now) {
          notifiedIds.current.add(post.id)
          ;(window as Window & { api?: { notify?: (t: string, b: string) => void } }).api?.notify?.(
            '⏰ Post due — Ready Set Post!',
            `"${post.title}" was scheduled for now.`
          )
        }
      }
    }

    check() // immediate check on mount
    const id = setInterval(check, CHECK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])
}
