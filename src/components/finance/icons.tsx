'use client'

interface IconProps {
  width?: number
  height?: number
  className?: string
  style?: React.CSSProperties
}

type IconName =
  | 'dashboard'
  | 'add'
  | 'tx'
  | 'trends'
  | 'import'
  | 'ai'
  | 'cats'
  | 'accounts'
  | 'settings'
  | 'bell'
  | 'search'
  | 'chevL'
  | 'chevR'
  | 'close'
  | 'arrowUp'
  | 'arrowDown'
  | 'logout'
  | 'bills'
  | 'savings'
  | 'piggy'
  | 'invest'

type CategoryIconName =
  | 'bag'
  | 'bowl'
  | 'leaf'
  | 'plane'
  | 'car'
  | 'bolt'
  | 'play'
  | 'pulse'
  | 'film'
  | 'income'
  | 'expense'

interface NamedIconProps extends IconProps {
  name: IconName
}

interface NamedCategoryIconProps extends IconProps {
  name: CategoryIconName
}

export function Icon({ name, width = 20, height = 20, className, style }: NamedIconProps) {
  const common = {
    width,
    height,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    style,
  }

  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="7" height="9" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
          <rect x="3.5" y="15.5" width="7" height="5" rx="1.5" />
          <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
        </svg>
      )
    case 'add':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8.5v7M8.5 12h7" />
        </svg>
      )
    case 'tx':
      return (
        <svg {...common}>
          <path d="M4 8h14M14 4l4 4-4 4" />
          <path d="M20 16H6M10 12l-4 4 4 4" />
        </svg>
      )
    case 'trends':
      return (
        <svg {...common}>
          <path d="M3 17l5-6 4 3 6-8" />
          <path d="M15 6h5v5" />
        </svg>
      )
    case 'import':
      return (
        <svg {...common}>
          <path d="M12 3v12M7.5 10.5L12 15l4.5-4.5" />
          <path d="M5 19h14" />
        </svg>
      )
    case 'ai':
      return (
        <svg {...common}>
          <path
            d="M11 3l1.5 4L17 8.5 12.5 10 11 14.5 9.5 10 5 8.5 9.5 7z"
            strokeLinejoin="round"
          />
          <path
            d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'cats':
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </svg>
      )
    case 'accounts':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 10h18" />
          <path d="M6.5 15h2.5" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...common}>
          <path d="M6.5 9a5.5 5.5 0 0 1 11 0v3.5l1.5 3h-14l1.5-3V9z" />
          <path d="M10 18.5a2 2 0 0 0 4 0" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M20 20l-4.4-4.4" />
        </svg>
      )
    case 'chevL':
      return (
        <svg {...common}>
          <path d="M14.5 6l-6 6 6 6" />
        </svg>
      )
    case 'chevR':
      return (
        <svg {...common}>
          <path d="M9.5 6l6 6-6 6" />
        </svg>
      )
    case 'close':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      )
    case 'arrowUp':
      return (
        <svg {...common}>
          <path d="M12 19V5M5.5 11.5l6.5-6.5 6.5 6.5" />
        </svg>
      )
    case 'arrowDown':
      return (
        <svg {...common}>
          <path d="M12 5v14M5.5 12.5l6.5 6.5 6.5-6.5" />
        </svg>
      )
    case 'logout':
      return (
        <svg {...common}>
          <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h12" />
        </svg>
      )
    case 'bills':
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="2"/>
          <path d="M9 7h6M9 11h6M9 15h4"/>
          <path d="M5 7H3M5 11H3M5 15H3"/>
        </svg>
      )
    case 'savings':
      return (
        <svg {...common}>
          <ellipse cx="12" cy="6" rx="7" ry="2.5"/>
          <path d="M5 6v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/>
          <path d="M5 10v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4"/>
        </svg>
      )
    case 'piggy':
      return (
        <svg {...common}>
          <path d="M19 9c0-3.3-3.1-6-7-6S5 5.7 5 9c0 1.5.6 2.9 1.6 4H5l1 4h2v2h8v-2h2l1-4h-1.6C19.4 11.9 20 10.5 19 9z"/>
          <path d="M9 9h.01M20 9h2"/>
        </svg>
      )
    case 'invest':
      return (
        <svg {...common}>
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      )
    default:
      return null
  }
}

export function CategoryIcon({
  name,
  width = 20,
  height = 20,
  className,
  style,
}: NamedCategoryIconProps) {
  const common = {
    width,
    height,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    style,
  }

  switch (name) {
    case 'bag':
      return (
        <svg {...common}>
          <path d="M5 8h14l-1.2 11.2A2 2 0 0 1 15.8 21H8.2a2 2 0 0 1-2-1.8L5 8z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
      )
    case 'bowl':
      return (
        <svg {...common}>
          <path d="M3 11h18M4 11a8 8 0 0 0 16 0M6 18h12" />
          <path d="M11 7c0-1.5 1-2 1-3M14 7c0-1.2.7-1.7.7-2.5" opacity="0.7" />
        </svg>
      )
    case 'leaf':
      return (
        <svg {...common}>
          <path d="M4 20c0-8 6-15 16-15 0 10-7 16-15 16 0-3 1.5-6 4-8.5" />
        </svg>
      )
    case 'plane':
      return (
        <svg {...common}>
          <path
            d="M3 14l8-2 4-9 1.5.5L14 11l5-1 1.5 1-5 3 .5 6-1.5.5-3-5-7 2-1.5-3z"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'car':
      return (
        <svg {...common}>
          <path d="M4 16v-3l2-5a2 2 0 0 1 1.9-1.3h8.2A2 2 0 0 1 18 8l2 5v3" />
          <path d="M3 16h18v3a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1H6.5v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3z" />
          <circle cx="7" cy="16.5" r="0.6" fill="currentColor" />
          <circle cx="17" cy="16.5" r="0.6" fill="currentColor" />
        </svg>
      )
    case 'bolt':
      return (
        <svg {...common}>
          <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" strokeLinejoin="round" />
        </svg>
      )
    case 'play':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="M10 9.5l5 2.5-5 2.5v-5z" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'pulse':
      return (
        <svg {...common}>
          <path d="M3 12h4l2-5 4 10 2-5h6" />
        </svg>
      )
    case 'film':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18M3 15h18M8 4v16M16 4v16" />
        </svg>
      )
    case 'income':
      return (
        <svg {...common}>
          <path d="M7 17L17 7M17 7H9M17 7v8" />
        </svg>
      )
    case 'expense':
      return (
        <svg {...common}>
          <path d="M17 7L7 17M7 17h8M7 17V9" />
        </svg>
      )
    default:
      return null
  }
}
