// Outline-ikoner i samma stil som banan-logon:
// viewBox 0 0 24 24, fill none, stroke #F5D020, runda horn.
// Anvands i valkomsttext och tomma tillstand istallet for emojis.

const STROKE = '#F5D020'

function base(props) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: STROKE,
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
  }
}

// Banan - samma path som logon
export function BananaIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M4 13c3.5-2 8-2 10 2a5.5 5.5 0 0 1 8 5" />
      <path d="M5.15 17.89c5.52-1.52 8.65-6.89 7-12C11.55 4 11.5 2 13 2c3.22 0 5 5.5 5 8 0 6.5-4.2 12-10.49 12C5.55 22 4 21.3 4 20c0-1.1.5-2.31 1.15-2.11Z" />
    </svg>
  )
}

// Progression - stigande linje med pil
export function TrendIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M17 7h4v4" />
    </svg>
  )
}

// PT-chatt - pratbubbla
export function ChatIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  )
}

// Tomt tillstand historik - hantel (horisontell, ren geometri)
export function DumbbellIcon(props) {
  return (
    <svg {...base(props)}>
      {/* vanster vikt */}
      <rect x="2" y="8" width="3.5" height="8" rx="1" />
      {/* hoger vikt */}
      <rect x="18.5" y="8" width="3.5" height="8" rx="1" />
      {/* stang */}
      <path d="M5.5 12h13" />
    </svg>
  )
}
