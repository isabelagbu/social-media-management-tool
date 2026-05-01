import { useEffect, useState } from 'react'
import { isHintsEnabled, HINTS_CHANGE_EVENT } from '../utils/hints'
import { WORKSPACE_SYNCED_EVENT } from '../workspace/sync'

export default function Tip({ children }: { children: React.ReactNode }): React.ReactElement | null {
  const [visible, setVisible] = useState(() => isHintsEnabled())

  useEffect(() => {
    function onchange(e: Event): void {
      setVisible((e as CustomEvent<boolean>).detail)
    }
    function onWorkspaceSynced(): void {
      setVisible(isHintsEnabled())
    }
    window.addEventListener(HINTS_CHANGE_EVENT, onchange)
    window.addEventListener(WORKSPACE_SYNCED_EVENT, onWorkspaceSynced)
    return () => {
      window.removeEventListener(HINTS_CHANGE_EVENT, onchange)
      window.removeEventListener(WORKSPACE_SYNCED_EVENT, onWorkspaceSynced)
    }
  }, [])

  if (!visible) return null

  return (
    <div className="tip-bar" role="note">
      <span className="tip-bar-icon" aria-hidden>💡</span>
      <span className="tip-bar-text">{children}</span>
    </div>
  )
}
