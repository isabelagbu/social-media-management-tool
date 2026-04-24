import { useEffect, useState } from 'react'
import { isHintsEnabled, HINTS_CHANGE_EVENT } from '../utils/hints'

export default function Tip({ children }: { children: React.ReactNode }): React.ReactElement | null {
  const [visible, setVisible] = useState(() => isHintsEnabled())

  useEffect(() => {
    function onchange(e: Event): void {
      setVisible((e as CustomEvent<boolean>).detail)
    }
    window.addEventListener(HINTS_CHANGE_EVENT, onchange)
    return () => window.removeEventListener(HINTS_CHANGE_EVENT, onchange)
  }, [])

  if (!visible) return null

  return (
    <div className="tip-bar" role="note">
      <span className="tip-bar-icon" aria-hidden>💡</span>
      <span className="tip-bar-text">{children}</span>
    </div>
  )
}
