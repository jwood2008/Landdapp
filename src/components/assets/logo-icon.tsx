/**
 * App logo — sharp geometric hexagon with inner diamond.
 * Refined luxury fintech aesthetic with crisp lines.
 */
export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer hexagon */}
      <path
        d="M12 2L21.5 7.5V16.5L12 22L2.5 16.5V7.5L12 2Z"
        fill="currentColor"
        opacity="0.08"
      />
      <path
        d="M12 2L21.5 7.5V16.5L12 22L2.5 16.5V7.5L12 2Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="bevel"
      />
      {/* Inner diamond */}
      <path
        d="M12 6.5L17 12L12 17.5L7 12L12 6.5Z"
        fill="currentColor"
        opacity="0.18"
      />
      <path
        d="M12 6.5L17 12L12 17.5L7 12L12 6.5Z"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="bevel"
      />
      {/* Center accent line */}
      <line
        x1="12" y1="9" x2="12" y2="15"
        stroke="currentColor"
        strokeWidth="0.6"
        opacity="0.4"
      />
    </svg>
  )
}
