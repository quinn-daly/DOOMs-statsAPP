interface DoomLogoProps {
  size?: number
  variant?: 'orange' | 'purple'
}

export function DoomHexMark({ size = 48, variant = 'orange' }: DoomLogoProps) {
  const accent = variant === 'purple' ? '#7a3dbf' : '#c25a00'
  const s = size
  const cx = s / 2
  const pts = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30)
    const r = s * 0.47
    return `${cx + r * Math.cos(angle)},${cx + r * Math.sin(angle)}`
  }).join(' ')
  const ptsInner = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30)
    const r = s * 0.35
    return `${cx + r * Math.cos(angle)},${cx + r * Math.sin(angle)}`
  }).join(' ')

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none">
      <polygon points={pts} stroke={accent} strokeWidth="2" fill="#111111" />
      <polygon points={ptsInner} stroke={accent} strokeWidth="0.5" fill="none" opacity="0.25" />
      <line x1={s * 0.18} y1={s * 0.46} x2={s * 0.82} y2={s * 0.46} stroke={accent} strokeWidth="0.75" opacity="0.4" />
      <line x1={s * 0.18} y1={s * 0.62} x2={s * 0.82} y2={s * 0.62} stroke={accent} strokeWidth="0.75" opacity="0.4" />
      <text
        x={cx}
        y={s * 0.59}
        textAnchor="middle"
        fontFamily="'Bebas Neue', sans-serif"
        fontSize={s * 0.28}
        fill="#f0ede8"
        letterSpacing={s * 0.04}
      >
        DOOM
      </text>
    </svg>
  )
}

export function NavLogoLockup() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <DoomHexMark size={40} variant="orange" />
      <div className="nav-wordmark">
        <span className="nav-wordmark-primary">SCOOBY DOOM</span>
        <span className="nav-wordmark-sub">Syracuse · Metro East</span>
      </div>
    </div>
  )
}
