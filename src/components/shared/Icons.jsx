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

// Banan-logga (skalad banan) - anvands overallt, smatt och stort.
// viewBox 368x448 (hogre an bred) - styr storlek via CSS width + height:auto.
export function BananaIcon({ className, style }) {
  return (
    <svg
      viewBox="0 0 368 448"
      className={className}
      style={style}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g transform="matrix(0.636301,0,0,0.636301,-179.27,-188.032)">
        <path d="M525.743,833.601C566.369,915.815 693.476,991.271 724.91,954.91C761.681,912.377 680.659,849.072 634.187,743.13C600.613,666.589 592.627,632.492 608.18,630.444C648.867,625.086 703.359,695.016 723.545,703.71C765.184,721.642 726.672,572.647 637.694,553.745" stroke="#F5D020" strokeWidth="33.91" />
        <path d="M414.853,593.167C358.586,695.278 475.158,894.161 470.34,787.871C465.935,690.684 496.752,640.851 539.852,615.322" stroke="#F5D020" strokeWidth="33.91" />
        <path d="M450.065,526.833C480.4,361.306 652.342,282.173 688.014,326.87C715.159,360.882 648.301,387.739 608.609,449.278C578.899,495.34 574.54,535.463 581.649,566.785" stroke="#FFFFFF" strokeWidth="33.91" />
      </g>
    </svg>
  )
}

// BananaLogo = alias for samma logga
export function BananaLogo(props) {
  return <BananaIcon {...props} />
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

// RIR - matare/gauge (hur hart du tar i, hur mycket kvar i tanken)
export function GaugeIcon(props) {
  return (
    <svg {...base(props)}>
      {/* halvcirkel-matare */}
      <path d="M4 18a8 8 0 1 1 16 0" />
      {/* nal */}
      <path d="M12 18l4-4" />
      {/* mittpunkt */}
      <circle cx="12" cy="18" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}
