/** Soft kawaii teddy for splash / loading — not a unicode emoji. */
export function LoadingBear({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
    >
      <title>Loading</title>
      {/* ears */}
      <circle cx="28" cy="32" r="16" fill="#E8C9A0" />
      <circle cx="92" cy="32" r="16" fill="#E8C9A0" />
      <circle cx="28" cy="32" r="9" fill="#F5DCC0" />
      <circle cx="92" cy="32" r="9" fill="#F5DCC0" />
      {/* head */}
      <circle cx="60" cy="62" r="38" fill="#F0D2A8" />
      {/* cheek blush */}
      <ellipse cx="34" cy="72" rx="8" ry="5" fill="#FFB8B0" opacity="0.55" />
      <ellipse cx="86" cy="72" rx="8" ry="5" fill="#FFB8B0" opacity="0.55" />
      {/* snout */}
      <ellipse cx="60" cy="78" rx="18" ry="14" fill="#FFF6E8" />
      {/* eyes */}
      <circle cx="46" cy="58" r="4.2" fill="#4A433C" />
      <circle cx="74" cy="58" r="4.2" fill="#4A433C" />
      <circle cx="47.5" cy="56.5" r="1.3" fill="#FFFFFF" />
      <circle cx="75.5" cy="56.5" r="1.3" fill="#FFFFFF" />
      {/* nose */}
      <ellipse cx="60" cy="72" rx="5" ry="3.8" fill="#5C534A" />
      {/* smile */}
      <path
        d="M52 80c3.5 5 12.5 5 16 0"
        stroke="#5C534A"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* bow / star accent */}
      <path
        d="M60 18l2.2 5.4 5.8.4-4.4 3.8 1.4 5.6L60 30.2 54.9 33.2l1.4-5.6-4.4-3.8 5.8-.4L60 18z"
        fill="#F0C96A"
      />
    </svg>
  )
}
