/**
 * App logo — XRPL-inspired X mark.
 * Clean, bold strokes forming the signature X shape from the XRP Ledger brand.
 */
export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Top-left to center */}
      <path
        d="M4.5 3.5L10.5 9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Top-right to center */}
      <path
        d="M19.5 3.5L13.5 9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Center node */}
      <circle
        cx="12"
        cy="12"
        r="2.5"
        fill="currentColor"
        opacity="0.15"
      />
      <circle
        cx="12"
        cy="12"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Bottom-left from center */}
      <path
        d="M4.5 20.5L10.5 14.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Bottom-right from center */}
      <path
        d="M19.5 20.5L13.5 14.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
