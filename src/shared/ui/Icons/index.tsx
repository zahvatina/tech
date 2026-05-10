import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

type IconComponent = (props: IconProps) => React.ReactElement;

function Icon({
  children,
  size = 16,
  className,
}: {
  children: React.ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={`ico${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

// Inferred type — not Record<string,...> to preserve exact keys under noUncheckedIndexedAccess
export const Icons = {
  dashboard: (p: IconProps) => (
    <Icon {...p}>
      <path d="M2 3h5v6H2zM9 3h5v3H9zM9 8h5v5H9zM2 11h5v2H2z" />
    </Icon>
  ),
  problems: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3.5M8 11h.01" />
    </Icon>
  ),
  triage: (p: IconProps) => (
    <Icon {...p}>
      <path d="M2 4h12M3 8h10M5 12h6" />
    </Icon>
  ),
  bug: (p: IconProps) => (
    <Icon {...p}>
      <path d="M5 5a3 3 0 0 1 6 0M3 8h10M4 7v3a4 4 0 0 0 8 0V7M2 6h2M12 6h2M2 12h2M12 12h2M8 8v6" />
    </Icon>
  ),
  ticket: (p: IconProps) => (
    <Icon {...p}>
      <path d="M2 5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2a1.5 1.5 0 0 0 0 3v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1.5 1.5 0 0 0 0-3z" />
      <path d="M7 4v8" strokeDasharray="1 1.5" />
    </Icon>
  ),
  product: (p: IconProps) => (
    <Icon {...p}>
      <path d="M3 5l5-2.5L13 5v6l-5 2.5L3 11zM3 5l5 2.5M13 5l-5 2.5M8 7.5V14" />
    </Icon>
  ),
  insight: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" />
      <circle cx="8" cy="8" r="3" />
    </Icon>
  ),
  search: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </Icon>
  ),
  filter: (p: IconProps) => (
    <Icon {...p}>
      <path d="M2 4h12M4 8h8M6 12h4" />
    </Icon>
  ),
  sort: (p: IconProps) => (
    <Icon {...p}>
      <path d="M4 3v10M4 13l-2-2M4 13l2-2M12 13V3M12 3l-2 2M12 3l2 2" />
    </Icon>
  ),
  plus: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 3v10M3 8h10" />
    </Icon>
  ),
  more: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="3" cy="8" r=".7" fill="currentColor" />
      <circle cx="8" cy="8" r=".7" fill="currentColor" />
      <circle cx="13" cy="8" r=".7" fill="currentColor" />
    </Icon>
  ),
  chev: (p: IconProps) => (
    <Icon {...p}>
      <path d="M6 4l4 4-4 4" />
    </Icon>
  ),
  chevDown: (p: IconProps) => (
    <Icon {...p}>
      <path d="M4 6l4 4 4-4" />
    </Icon>
  ),
  link: (p: IconProps) => (
    <Icon {...p}>
      <path d="M7 9a3 3 0 0 0 4 0l2-2a3 3 0 1 0-4-4l-1 1M9 7a3 3 0 0 0-4 0L3 9a3 3 0 1 0 4 4l1-1" />
    </Icon>
  ),
  user: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="8" cy="6" r="2.5" />
      <path d="M3 14a5 5 0 0 1 10 0" />
    </Icon>
  ),
  team: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="11" cy="6.5" r="1.5" />
      <path d="M2 13a4 4 0 0 1 8 0M9 13a4 4 0 0 1 5 0" />
    </Icon>
  ),
  alert: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 2l6 11H2zM8 6v3M8 11h.01" />
    </Icon>
  ),
  fire: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 14a4 4 0 0 1-3-6.5C7 6 6 4 8 2c0 2 4 3 4 7.5A4 4 0 0 1 8 14" />
    </Icon>
  ),
  pin: (p: IconProps) => (
    <Icon {...p}>
      <path d="M11 3l2 2-3 1-1 4-2-2-4 4 1-4-2-2 4-1 1-3z" />
    </Icon>
  ),
  star: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 2l1.7 3.7L13.5 6l-2.8 2.6.7 3.9L8 10.7 4.6 12.5l.7-3.9L2.5 6l3.8-.3z" />
    </Icon>
  ),
  bell: (p: IconProps) => (
    <Icon {...p}>
      <path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3zM6.5 13.5a1.5 1.5 0 0 0 3 0" />
    </Icon>
  ),
  flow: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="3" cy="3" r="1.5" />
      <circle cx="13" cy="13" r="1.5" />
      <circle cx="13" cy="3" r="1.5" />
      <circle cx="3" cy="13" r="1.5" />
      <path d="M4.5 4.5L11.5 11.5M4.5 11.5L11.5 4.5" />
    </Icon>
  ),
  arrowUp: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 13V3M4 7l4-4 4 4" />
    </Icon>
  ),
  arrowDn: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 3v10M4 9l4 4 4-4" />
    </Icon>
  ),
  arrowRt: (p: IconProps) => (
    <Icon {...p}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </Icon>
  ),
  command: (p: IconProps) => (
    <Icon {...p}>
      <path d="M5 5h6v6H5zM5 5V3.5A1.5 1.5 0 1 0 3.5 5zM11 5h1.5A1.5 1.5 0 1 0 11 3.5zM5 11v1.5A1.5 1.5 0 1 1 3.5 11zM11 11v1.5A1.5 1.5 0 1 0 12.5 11z" />
    </Icon>
  ),
  close: (p: IconProps) => (
    <Icon {...p}>
      <path d="M3 3l10 10M13 3L3 13" />
    </Icon>
  ),
  check: (p: IconProps) => (
    <Icon {...p}>
      <path d="M3 8l3.5 3.5L13 5" />
    </Icon>
  ),
  spark: (p: IconProps) => (
    <Icon {...p}>
      <path d="M2 11l3-4 3 2 3-5 3 4" />
    </Icon>
  ),
  doc: (p: IconProps) => (
    <Icon {...p}>
      <path d="M4 2h5l3 3v9H4zM9 2v3h3" />
    </Icon>
  ),
  chat: (p: IconProps) => (
    <Icon {...p}>
      <path d="M2 4h12v7H8l-3 2v-2H2z" />
    </Icon>
  ),
  globe: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" />
    </Icon>
  ),
  mobile: (p: IconProps) => (
    <Icon {...p}>
      <rect x="5" y="2" width="6" height="12" rx="1" />
      <path d="M7 12h2" />
    </Icon>
  ),
  monitor: (p: IconProps) => (
    <Icon {...p}>
      <rect x="2" y="3" width="12" height="8" rx="1" />
      <path d="M5 13h6M8 11v2" />
    </Icon>
  ),
  server: (p: IconProps) => (
    <Icon {...p}>
      <rect x="2" y="3" width="12" height="4" rx="1" />
      <rect x="2" y="9" width="12" height="4" rx="1" />
      <circle cx="4.5" cy="5" r=".5" fill="currentColor" />
      <circle cx="4.5" cy="11" r=".5" fill="currentColor" />
    </Icon>
  ),
  ai: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M4 12l2-2M10 6l2-2" />
      <circle cx="8" cy="8" r="1.5" />
    </Icon>
  ),
  clock: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3l2 1.5" />
    </Icon>
  ),
  shield: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 2L3 4v4c0 3 2 5 5 6 3-1 5-3 5-6V4z" />
    </Icon>
  ),
  paperclip: (p: IconProps) => (
    <Icon {...p}>
      <path d="M11 5L5.5 10.5a2.5 2.5 0 0 0 3.5 3.5L14 8.5a4 4 0 0 0-5.5-5.5L4 7" />
    </Icon>
  ),
} satisfies Record<string, IconComponent>;
