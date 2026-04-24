/** Sample posts shown on first launch (no content-store.json yet). */
export function getSeedPosts(): Record<string, unknown>[] {
  const now = Date.now()
  const ago = (h: number) => new Date(now - h * 3600_000).toISOString()
  const from = (h: number) => new Date(now + h * 3600_000).toISOString()

  return [
    // ── Posted (show in Recent Posts grid) ───────────────────────────────────
    {
      id: 'seed-p1',
      title: 'Day in my life — editing vlog',
      body: 'Come along for a full day of content creation — filming, editing, posting, and everything in between. Drop your questions below!',
      platforms: ['YouTube'],
      accountIds: [],
      status: 'posted',
      scheduledAt: ago(10),
      postedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      createdAt: ago(72)
    },
    {
      id: 'seed-p2',
      title: 'Productivity setup tour',
      body: 'My full desk + app setup for managing content across 5 platforms. Comment your fave tool below!',
      platforms: ['YouTube'],
      accountIds: [],
      status: 'posted',
      scheduledAt: ago(34),
      postedUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      createdAt: ago(120)
    },
    {
      id: 'seed-p3',
      title: 'Hot take: batch filming is overrated',
      body: 'Hot take: batch filming is overrated for solo creators. Here\'s why I film one video at a time and what changed when I did. Agree or disagree?',
      platforms: ['X'],
      accountIds: [],
      status: 'posted',
      scheduledAt: ago(48),
      postedUrl: null,
      createdAt: ago(96)
    },
    {
      id: 'seed-p4',
      title: 'What 6 months of consistent posting taught me',
      body: '6 months of posting consistently on LinkedIn. Here\'s what actually moved the needle — and what was a total waste of time. Full breakdown in the comments.',
      platforms: ['LinkedIn'],
      accountIds: [],
      status: 'posted',
      scheduledAt: ago(60),
      postedUrl: null,
      createdAt: ago(144)
    },
    {
      id: 'seed-p5',
      title: 'Behind the scenes — content week',
      body: 'Behind the scenes of a full content week ✨ Swipe to see how we planned, filmed, and scheduled 12 posts in 2 days.',
      platforms: ['Instagram'],
      accountIds: [],
      status: 'posted',
      scheduledAt: ago(84),
      postedUrl: null,
      createdAt: ago(168)
    },
    {
      id: 'seed-p6',
      title: 'POV: you finally found your content rhythm',
      body: 'POV: you finally found your posting rhythm and your analytics are going up 📈 #contentcreator #socialmediatips',
      platforms: ['TikTok'],
      accountIds: [],
      status: 'posted',
      scheduledAt: ago(20),
      postedUrl: null,
      createdAt: ago(48)
    },
    {
      id: 'seed-p7',
      title: 'Tools I use to manage all my platforms',
      body: 'These are the exact tools in my content stack — planning, scheduling, analytics, and editing. No gatekeeping.',
      platforms: ['YouTube'],
      accountIds: [],
      status: 'posted',
      scheduledAt: ago(110),
      postedUrl: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
      createdAt: ago(200)
    },

    // ── Scheduled (upcoming) ─────────────────────────────────────────────────
    {
      id: 'seed-s1',
      title: 'Weekly content roundup — week 15',
      body: 'This week\'s content roundup: what performed, what flopped, and what I\'m doing differently next week.',
      platforms: ['LinkedIn'],
      accountIds: [],
      status: 'scheduled',
      scheduledAt: from(6),
      postedUrl: null,
      createdAt: ago(24)
    },
    {
      id: 'seed-s2',
      title: 'Talking to camera tips for beginners',
      body: 'If you struggle talking to camera, this one is for you. 5 drills that made me 10x more natural in front of a lens.',
      platforms: ['TikTok', 'Instagram'],
      accountIds: [],
      status: 'scheduled',
      scheduledAt: from(18),
      postedUrl: null,
      createdAt: ago(12)
    },
    {
      id: 'seed-s3',
      title: 'Announcement: new series dropping',
      body: 'Something new is coming. I\'ve been working on this series for 3 months and I\'m finally ready to share. Stay tuned 👀',
      platforms: ['YouTube', 'Instagram'],
      accountIds: [],
      status: 'scheduled',
      scheduledAt: from(30),
      postedUrl: null,
      createdAt: ago(6)
    },
    {
      id: 'seed-s4',
      title: 'LinkedIn carousel — building in public',
      body: 'Slide 1: "I\'m building in public and here\'s everything I learned in month 1." 7-slide carousel. Hook on every slide.',
      platforms: ['LinkedIn'],
      accountIds: [],
      status: 'scheduled',
      scheduledAt: from(50),
      postedUrl: null,
      createdAt: ago(18)
    },
    {
      id: 'seed-s5',
      title: 'Engagement thread — your biggest content fear',
      body: 'Reply with your biggest fear about posting consistently. I\'ll reply to every single one. Let\'s talk about it.',
      platforms: ['X'],
      accountIds: [],
      status: 'scheduled',
      scheduledAt: from(72),
      postedUrl: null,
      createdAt: ago(3)
    },
    {
      id: 'seed-s6',
      title: 'Creator Q&A — live session',
      body: 'Going live this Sunday to answer your questions about content strategy, growth, and staying consistent. Drop your Qs below!',
      platforms: ['YouTube', 'Instagram'],
      accountIds: [],
      status: 'scheduled',
      scheduledAt: from(96),
      postedUrl: null,
      createdAt: ago(8)
    },
    {
      id: 'seed-s7',
      title: 'Platform algorithm breakdown 2026',
      body: 'What\'s actually working on each platform right now. I tested 30 posts across 5 platforms over 6 weeks. Here\'s the data.',
      platforms: ['YouTube'],
      accountIds: [],
      status: 'scheduled',
      scheduledAt: from(120),
      postedUrl: null,
      createdAt: ago(36)
    },
    {
      id: 'seed-s8',
      title: 'Morning routine — content creator edition',
      body: 'My 90-minute morning routine that sets up every content day. No fluff, just what actually works.',
      platforms: ['TikTok'],
      accountIds: [],
      status: 'scheduled',
      scheduledAt: from(144),
      postedUrl: null,
      createdAt: ago(2)
    },

    // ── Overdue (scheduled but in the past) ──────────────────────────────────
    {
      id: 'seed-o1',
      title: 'April content recap',
      body: 'Monthly recap — what I posted, what resonated, what I\'m carrying into next month.',
      platforms: ['LinkedIn', 'X'],
      accountIds: [],
      status: 'scheduled',
      scheduledAt: ago(26),
      postedUrl: null,
      createdAt: ago(80)
    },
    {
      id: 'seed-o2',
      title: 'Collab teaser post',
      body: 'Teaser for the upcoming collab. Keep it vague — just enough to build curiosity.',
      platforms: ['Instagram'],
      accountIds: [],
      status: 'scheduled',
      scheduledAt: ago(5),
      postedUrl: null,
      createdAt: ago(30)
    },

    // ── Drafts ───────────────────────────────────────────────────────────────
    {
      id: 'seed-d1',
      title: 'How I script a YouTube video in 20 mins',
      body: 'Scripting method that takes me from blank page to full script in under 20 minutes. Template at the end.',
      platforms: ['YouTube'],
      accountIds: [],
      status: 'draft',
      scheduledAt: null,
      postedUrl: null,
      createdAt: ago(1)
    },
    {
      id: 'seed-d2',
      title: 'Unpopular opinion: stop optimising for virality',
      body: 'Unpopular opinion: chasing virality is killing your long-term growth. Here\'s what to focus on instead.',
      platforms: ['X', 'LinkedIn'],
      accountIds: [],
      status: 'draft',
      scheduledAt: null,
      postedUrl: null,
      createdAt: ago(4)
    },
    {
      id: 'seed-d3',
      title: 'Reel idea — "what I wish I knew"',
      body: 'Trending audio + text overlay. "What I wish I knew before starting my content journey" — 5 slides, fast cuts.',
      platforms: ['Instagram', 'TikTok'],
      accountIds: [],
      status: 'draft',
      scheduledAt: null,
      postedUrl: null,
      createdAt: ago(7)
    },
    {
      id: 'seed-d4',
      title: 'Newsletter → LinkedIn repurpose',
      body: 'Repurpose last week\'s newsletter issue into a LinkedIn post. Pull the best insight, reframe it as a take.',
      platforms: ['LinkedIn'],
      accountIds: [],
      status: 'draft',
      scheduledAt: null,
      postedUrl: null,
      createdAt: ago(9)
    },
    {
      id: 'seed-d5',
      title: 'Short-form hook tests',
      body: 'Testing 3 different hooks for the same piece of content:\nA) "Nobody talks about this..."\nB) "I was wrong about..."\nC) "Stop doing this if you want to grow"',
      platforms: ['TikTok'],
      accountIds: [],
      status: 'draft',
      scheduledAt: null,
      postedUrl: null,
      createdAt: ago(14)
    },
    {
      id: 'seed-d6',
      title: 'Raw thoughts — burnout and rest',
      body: 'Unscripted. No b-roll. Just honest thoughts on creator burnout, why I took a break, and how I came back.',
      platforms: ['YouTube'],
      accountIds: [],
      status: 'draft',
      scheduledAt: null,
      postedUrl: null,
      createdAt: ago(2)
    }
  ]
}

/** Sample notepad text shown on first launch. */
export const SEED_SCRATCHPAD = `Content ideas
─────────────
• Hook test: "Nobody talks about this side of content creation…"
• Collab idea — reach out to @creator next week
• Hashtag rotation: #buildinpublic #creatoreconomy #contentcreator

Reminders
─────────
• Update link in bio before Sunday's post
• Export analytics before end of month
• Check thumbnail A/B test results

(This pad saves automatically — rename tabs by double-clicking them.)`
