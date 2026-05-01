import { useEffect, useState } from 'react'
import { PLATFORM_OPTIONS } from '../posts/types'
import { ENABLED_PLATFORMS_EVENT, getEnabledPlatformFormLabels } from '../utils/enabledPlatforms'
import { WORKSPACE_SYNCED_EVENT } from '../workspace/sync'

type Label = (typeof PLATFORM_OPTIONS)[number]

export function useEnabledPlatformFormLabels(): Label[] {
  const [labels, setLabels] = useState<Label[]>(() => getEnabledPlatformFormLabels())
  useEffect(() => {
    const sync = (): void => setLabels([...getEnabledPlatformFormLabels()])
    window.addEventListener(ENABLED_PLATFORMS_EVENT, sync)
    window.addEventListener(WORKSPACE_SYNCED_EVENT, sync)
    return () => {
      window.removeEventListener(ENABLED_PLATFORMS_EVENT, sync)
      window.removeEventListener(WORKSPACE_SYNCED_EVENT, sync)
    }
  }, [])
  return labels
}
