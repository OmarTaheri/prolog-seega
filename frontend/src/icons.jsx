const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const make = (children) => {
  const Icon = ({ size = 22, ...props }) => (
    <svg {...base} width={size} height={size} aria-hidden="true" {...props}>{children}</svg>
  )
  return Icon
}

export const IconGame = make(<>
  <circle cx="12" cy="7" r="3.2" />
  <path d="M8.5 12.5h7l1.5 4.5H7z" />
  <path d="M5 20h14" />
</>)
export const IconTree = make(<>
  <rect x="9.5" y="2.5" width="5" height="4.5" rx="1" />
  <rect x="2.5" y="16.5" width="5" height="4.5" rx="1" />
  <rect x="9.5" y="16.5" width="5" height="4.5" rx="1" />
  <rect x="16.5" y="16.5" width="5" height="4.5" rx="1" />
  <path d="M12 7v4.5M5 16.5v-2.5h14v2.5M12 11.5v5" />
</>)
export const IconCoach = make(<>
  <path d="M9 18h6M10 21h4" />
  <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" />
</>)
export const IconMoves = make(<>
  <path d="M9 6h11M9 12h11M9 18h11" />
  <path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth="2.6" />
</>)
export const IconStats = make(<>
  <rect x="4" y="12" width="3.5" height="8" rx="1" />
  <rect x="10.25" y="7" width="3.5" height="13" rx="1" />
  <rect x="16.5" y="4" width="3.5" height="16" rx="1" />
</>)
export const IconInfo = make(<>
  <circle cx="12" cy="12" r="9" />
  <path d="M12 11v5.5M12 7.5h.01" strokeWidth="2.2" />
</>)
export const IconSettings = make(<>
  <circle cx="12" cy="12" r="3" />
  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
</>)
export const IconVolume = make(<>
  <path d="M11 5 6 9H3v6h3l5 4z" />
  <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
</>)
export const IconMute = make(<>
  <path d="M11 5 6 9H3v6h3l5 4z" />
  <path d="m16 9 5 6M21 9l-5 6" />
</>)
export const IconArrowLeft = make(<path d="M19 12H5M11 6l-6 6 6 6" />)
export const IconArrowRight = make(<path d="M5 12h14M13 6l6 6-6 6" />)
export const IconPlay = make(<path d="M7 4.5v15l12-7.5z" />)
export const IconPause = make(<path d="M8 5v14M16 5v14" strokeWidth="2.4" />)
export const IconPrev = make(<path d="m14.5 5-7 7 7 7" />)
export const IconNext = make(<path d="m9.5 5 7 7-7 7" />)
export const IconBulb = make(<>
  <path d="M9 18h6M10 21h4" />
  <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" />
  <path d="M12 7v3" />
</>)
export const IconFlip = make(<>
  <path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.5" />
  <path d="M4 4v4.5h4.5" />
  <path d="M4 13a8 8 0 0 0 13.7 4.7L20 15.5" />
  <path d="M20 20v-4.5h-4.5" />
</>)
export const IconNew = make(<>
  <path d="M12 5v14M5 12h14" />
</>)
export const IconClose = make(<path d="M6 6l12 12M18 6 6 18" />)
export const IconStop = make(<rect x="6" y="6" width="12" height="12" rx="2" />)
