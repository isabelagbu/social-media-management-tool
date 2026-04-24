import { useState } from 'react'
import { createPortal } from 'react-dom'
import BrandLogo from './BrandLogo'

const ONBOARDING_KEY = 'smm-onboarded'

export function hasSeenOnboarding(): boolean {
  try { return localStorage.getItem(ONBOARDING_KEY) === '1' } catch { return false }
}

function markOnboarded(): void {
  try { localStorage.setItem(ONBOARDING_KEY, '1') } catch {}
}

const STEPS = [
  {
    icon: <BrandLogo size={80} />,
    title: 'Welcome to Ready Set Post!',
    body: 'Your personal desktop studio for planning, scheduling, and managing social media content — all in one place, offline.'
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" width="52" height="52">
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    title: 'Create & schedule posts',
    body: 'Hit the + button in Content or Calendar to write a post. Add a date to schedule it, or save it as a draft to come back to later.'
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" width="52" height="52">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
    title: 'See your schedule at a glance',
    body: 'The Calendar view shows all your scheduled posts by date. Click any day to view, create, or edit posts for that day.'
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" width="52" height="52">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    title: 'Add your accounts',
    body: 'Go to Settings → Accounts to add your TikTok, Instagram, YouTube, LinkedIn, and X profiles. Each one gets its own browser tab in the Accounts view.'
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" width="52" height="52">
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        <path d="M3 21h4" />
      </svg>
    ),
    title: 'Write your scripts & notes',
    body: 'Open any post\'s detail view to write a full script, hashtags, and production notes. Use the Notepad for anything else — 10 tabs, all yours.'
  }
]

export default function OnboardingModal({ onDone }: { onDone: () => void }): React.ReactElement {
  const [step, setStep] = useState(0)
  const isLast = step === STEPS.length - 1

  function finish(): void {
    markOnboarded()
    onDone()
  }

  const current = STEPS[step]

  return createPortal(
    <div className="onboarding-backdrop">
      <div className="onboarding-card" role="dialog" aria-modal="true" aria-label="Welcome to Ready Set Post!">

        {/* Progress dots */}
        <div className="onboarding-dots" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={`onboarding-dot${i === step ? ' onboarding-dot--active' : ''}`} />
          ))}
        </div>

        {/* Content */}
        <div className="onboarding-body">
          <div className="onboarding-icon" aria-hidden>{current.icon}</div>
          <h2 className="onboarding-title">{current.title}</h2>
          <p className="onboarding-text muted">{current.body}</p>
        </div>

        {/* Actions */}
        <div className="onboarding-actions">
          {step > 0 ? (
            <button type="button" className="ghost" onClick={() => setStep(s => s - 1)}>
              Back
            </button>
          ) : (
            <button type="button" className="ghost" onClick={finish}>
              Skip
            </button>
          )}

          <button
            type="button"
            className="primary"
            onClick={isLast ? finish : () => setStep(s => s + 1)}
          >
            {isLast ? "Let's go!" : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
