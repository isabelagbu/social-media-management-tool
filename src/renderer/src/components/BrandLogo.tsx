export default function BrandLogo({ size = 28 }: { size?: number }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Ready Set Post!"
      role="img"
    >
      {/* ── Ring handles — evenly spread: cx=15, 40, 65 ── */}
      <circle cx="20" cy="10" r="5.5" fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="40" cy="10" r="5.5" fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="60" cy="10" r="5.5" fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round" />

      {/* ── Calendar body ── */}
      <rect x="5" y="12" width="70" height="62" rx="9" fill="var(--surface)" />

      {/* ── Header band ── */}
      <path d="M5 21 Q5 12 14 12 H66 Q75 12 75 21 V34 H5 Z" fill="var(--accent)" />

      {/* ── Grid columns — 5 cols, dividers every 14px: 19, 33, 47, 61 ── */}
      {[19, 33, 47, 61].map((x) => (
        <line key={x} x1={x} y1="34" x2={x} y2="74" stroke="var(--accent-border)" strokeWidth="0.8" />
      ))}

      {/* ── Grid rows — 4 rows, dividers every 10px: 44, 54, 64 ── */}
      {[44, 54, 64].map((y) => (
        <line key={y} x1="5" y1={y} x2="75" y2={y} stroke="var(--accent-border)" strokeWidth="0.8" />
      ))}

      {/* ── Camera icon — bottom-right cell (x:61→75, y:64→74) ── */}
      {/* body */}
      <rect x="62" y="65" width="12" height="8" rx="2" fill="var(--accent)" />
      {/* lens */}
      <circle cx="68" cy="69" r="2.4" fill="var(--surface)" />
      <circle cx="68" cy="69" r="1.1" fill="var(--accent)" opacity="0.5" />
      {/* flash bump */}
      <rect x="64" y="62.5" width="4" height="3" rx="1" fill="var(--accent)" />
    </svg>
  )
}
