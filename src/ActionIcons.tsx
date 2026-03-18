interface IconProps {
  size?: number
  color?: string
}

export function IconCatch({ size = 32, color = '#4ddd4d' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="12" rx="10" ry="3" stroke={color} strokeWidth="1.5" />
      <ellipse cx="16" cy="12" rx="6" ry="1.5" stroke={color} strokeWidth="0.8" opacity="0.5" />
      <path d="M8 18 Q8 28 16 28 Q24 28 24 18" stroke={color} strokeWidth="1.5" fill="none" />
      <line x1="10" y1="16" x2="8" y2="20" stroke={color} strokeWidth="1.5" />
      <line x1="22" y1="16" x2="24" y2="20" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

export function IconGoal({ size = 32, color = '#6aef6a' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="14" rx="8" ry="2.5" stroke={color} strokeWidth="1.5" />
      <line x1="6" y1="22" x2="6" y2="8" stroke={color} strokeWidth="1.5" />
      <line x1="26" y1="22" x2="26" y2="8" stroke={color} strokeWidth="1.5" />
      <line x1="6" y1="8" x2="26" y2="8" stroke={color} strokeWidth="1.5" />
      <path d="M12 27 L16 14" stroke={color} strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
    </svg>
  )
}

export function IconThrowaway({ size = 32, color = '#ff8c2a' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <ellipse cx="14" cy="14" rx="8" ry="2.5" stroke={color} strokeWidth="1.5" />
      <path d="M20 12 Q28 8 28 18" stroke={color} strokeWidth="1.5" fill="none" strokeDasharray="3 2" />
      <line x1="24" y1="22" x2="30" y2="16" stroke={color} strokeWidth="1.5" />
      <line x1="24" y1="22" x2="22" y2="16" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

export function IconDrop({ size = 32, color = '#ffaa22' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="10" rx="8" ry="2.5" stroke={color} strokeWidth="1.5" />
      <line x1="16" y1="12" x2="16" y2="24" stroke={color} strokeWidth="1.5" strokeDasharray="2 2" />
      <ellipse cx="16" cy="26" rx="6" ry="2" stroke={color} strokeWidth="1" opacity="0.4" />
      <line x1="10" y1="20" x2="14" y2="24" stroke={color} strokeWidth="1.5" />
      <line x1="22" y1="20" x2="18" y2="24" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

export function IconD({ size = 32, color = '#4a9dff' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 3 L28 8 L28 19 Q28 28 16 32 Q4 28 4 19 L4 8 Z" stroke={color} strokeWidth="1.5" fill="rgba(10,26,58,0.6)" />
      <ellipse cx="16" cy="17" rx="9" ry="2.8" stroke={color} strokeWidth="1.2" transform="rotate(-18 16 17)" opacity="0.5" />
      <line x1="9" y1="10" x2="23" y2="24" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function IconCallahan({ size = 32, color = '#c07aff' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="13" rx="7" ry="7" fill="rgba(42,10,58,0.8)" stroke={color} strokeWidth="1.5" />
      <ellipse cx="12" cy="12" rx="2.5" ry="3" fill="#0a0a0a" />
      <ellipse cx="20" cy="12" rx="2.5" ry="3" fill="#0a0a0a" />
      <rect x="11" y="18" width="10" height="5" rx="1" fill="rgba(42,10,58,0.8)" stroke={color} strokeWidth="1" />
      <rect x="13" y="18" width="2" height="3" rx="0.5" fill="#0a0a0a" />
      <rect x="17" y="18" width="2" height="3" rx="0.5" fill="#0a0a0a" />
      <path d="M5 29 Q16 22 27 29" stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  )
}

export function IconPull({ size = 32, color = '#1ae0e0' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M5 26 Q9 8 26 10" stroke={color} strokeWidth="1.5" fill="none" />
      <ellipse cx="24" cy="10" rx="6" ry="2" stroke={color} strokeWidth="1.5" transform="rotate(-15 24 10)" />
      <polygon points="26,17 30,10 21,10" fill={color} opacity="0.7" />
    </svg>
  )
}

export function IconUndo({ size = 32, color = '#666666' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M10 8 L6 12 L10 16" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M6 12 Q6 24 20 24 Q28 24 28 16" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}
