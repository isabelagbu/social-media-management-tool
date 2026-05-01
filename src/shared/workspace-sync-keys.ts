/**
 * localStorage keys mirrored to Google Drive (`workspace.json`) for cross-device continuity.
 * Keep in sync with actual keys used in the renderer.
 */
export const WORKSPACE_LOCALSTORAGE_KEYS = [
  'smm-accounts',
  'smm-accounts-demo-v',
  'smm-onboarded',
  'smm-accounts-preview-enabled',
  'smm-notepad-tabs-v2',
  'smm-notepad-active',
  'smm-notepad-demo-v',
  'smm-sticky-notes',
  'smm-dash-greeting',
  'smm-dash-banner',
  'smm-reminders-enabled',
  'smm-platforms-form-enabled',
  'smm-dash-banner-enabled',
  'smm-hints-enabled',
  'smm-content-section',
  'smm-theme',
  'smm-accent',
  'smm-sound-enabled'
] as const

export type WorkspaceLocalStorageKey = (typeof WORKSPACE_LOCALSTORAGE_KEYS)[number]
