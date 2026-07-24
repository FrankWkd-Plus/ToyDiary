import type { SVGProps } from 'react'

const STROKE = '#5b4638'

function iconProps(props: SVGProps<SVGSVGElement>) {
  return {
    viewBox: '0 0 48 48',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
    ...props,
  }
}

export function DiaryNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path
        d="M12 9.5 35.2 6c3-.5 5.8 1.8 6 4.9l1.5 24.3c.2 2.7-1.8 5-4.4 5.3L15.5 43c-3 .3-5.6-2-5.6-5V14.4c0-2.5.8-4.4 2.1-4.9Z"
        fill="var(--color-mustard)"
        stroke={STROKE}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="m17.2 39.9 1 6 3.7-3.7 4.4 2.6-.9-6.6"
        fill="var(--color-peach)"
        stroke={STROKE}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9.8 14.5c-3.4-1.5-4.6 3.6-.9 3.3M9.8 21.2c-3.4-1.5-4.6 3.6-.9 3.3M9.8 28c-3.4-1.5-4.6 3.6-.9 3.3M9.8 34.8c-3.4-1.5-4.6 3.6-.9 3.3"
        stroke={STROKE}
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M19.2 15.1c.7-3.3 5.4-3 5.7.2 2.5-1.8 6 .8 4.5 3.5 2.8 1.6 1.5 5.6-1.8 5.5h-9.9c-4.8.1-5.3-6.9-.6-7.7.3-.7 1-1.2 2.1-1.5Z"
        fill="#fffdf8"
      />
      <circle cx="21" cy="20.1" r="1" fill={STROKE} />
      <circle cx="26.6" cy="20.1" r="1" fill={STROKE} />
      <path
        d="M22.4 22.3c1 .9 2.2.9 3.1 0M20 30h12M20 34h9"
        stroke={STROKE}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function GrowthNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path
        d="M24 23.7c-.2-7.1.4-11.5 2.2-15.4"
        stroke={STROKE}
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path
        d="M25.7 12.3C28.8 5.4 36.8 5.2 40 9c-1.4 6.8-8.2 10.6-14.3 3.3Z"
        fill="var(--color-mint)"
        stroke={STROKE}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M24.1 13.4C21.6 6.6 13.7 4.9 9.7 8.2c.5 6.8 7.4 11.6 14.4 5.2Z"
        fill="var(--color-mint-deep)"
        stroke={STROKE}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M13.1 23.7c.4-2 2.2-3.2 4.2-3.2h13.8c2.2 0 4 1.6 4.3 3.7l2.1 14.5c.4 2.8-1.7 5.3-4.5 5.6-5.8.6-12.1.5-18.1-.1-2.7-.3-4.6-2.8-4.2-5.5l2.4-15Z"
        fill="var(--color-terra-soft)"
        stroke={STROKE}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 24c5.6 2.4 15.8 2.6 21.7.1"
        stroke={STROKE}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="20.4" cy="34.3" r="1.3" fill={STROKE} />
      <circle cx="29.4" cy="34.3" r="1.3" fill={STROKE} />
      <path
        d="M22.5 38c1.5 1.6 3.3 1.6 4.8 0"
        stroke={STROKE}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="m40.2 17.2 1.1 2.4 2.5 1-2.5 1.1-1.1 2.5-1.1-2.5-2.4-1.1 2.4-1Z"
        fill="var(--color-mustard)"
        stroke="var(--color-terra-deep)"
        strokeWidth="1"
      />
    </svg>
  )
}

export function ConversationNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path
        d="M6.2 22.7C5.4 14.4 12.4 8 21.3 8c9.1 0 15.7 6 15.1 13.5-.5 7.4-7.6 13-16.2 12.2l-7.5 4.1 1.3-6.3c-4.4-2-7.4-5-7.8-8.8Z"
        fill="var(--color-mint)"
        stroke={STROKE}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M31.8 28.4c.3 4.1 3.4 7.2 7.7 7.3l3.8 2-.6-3.5c2-1.3 3.2-3.3 3.1-5.5-.2-4.2-3.9-7.5-8.7-7.4-2.1 0-4 .7-5.3 1.8"
        fill="var(--color-mustard)"
        stroke={STROKE}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="15.6" cy="21" r="1.2" fill={STROKE} />
      <circle cx="25.4" cy="21" r="1.2" fill={STROKE} />
      <path
        d="M18 25.3c1.7 1.8 3.8 1.8 5.4 0"
        stroke={STROKE}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="m39.3 8.4 1.2 2.7 2.8 1.2-2.8 1.2-1.2 2.8-1.2-2.8-2.7-1.2 2.7-1.2Z"
        fill="var(--color-mustard)"
        stroke="var(--color-terra-deep)"
        strokeWidth="1"
      />
    </svg>
  )
}

export function MeNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <circle
        cx="24"
        cy="24"
        r="19"
        fill="var(--color-mustard-soft)"
        stroke={STROKE}
        strokeWidth="2.3"
      />
      <circle
        cx="24"
        cy="19"
        r="8"
        fill="#fffaf3"
        stroke={STROKE}
        strokeWidth="1.8"
      />
      <path
        d="M10.9 38.1c2.7-7.2 7.1-10.2 13.1-10.2 6.1 0 10.7 3.1 13.2 10.3-7 6.1-19 6.1-26.3-.1Z"
        fill="var(--color-mint)"
        stroke={STROKE}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="21" cy="18.6" r="1" fill={STROKE} />
      <circle cx="27" cy="18.6" r="1" fill={STROKE} />
      <path
        d="M22.1 22.1c1.2 1.3 2.7 1.3 3.9 0"
        stroke={STROKE}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="17.8" cy="21.5" r="1.5" fill="var(--color-peach)" opacity=".8" />
      <circle cx="30.2" cy="21.5" r="1.5" fill="var(--color-peach)" opacity=".8" />
    </svg>
  )
}
