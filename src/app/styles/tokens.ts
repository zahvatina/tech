/**
 * CSS custom property references — type-safe aliases for all design tokens.
 * Values live in global.styled.ts (:root). Use TOKEN.* inside styled-components
 * instead of raw `var(--...)` strings to get autocomplete and refactoring support.
 */
export const TOKEN = {
  // ── Accent ─────────────────────────────────────────────────────────────
  accent:     'var(--accent)',
  accentSoft: 'var(--accent-soft)',
  accentInk:  'var(--accent-ink)',

  // ── Backgrounds ────────────────────────────────────────────────────────
  bg:      'var(--bg)',
  bgElev:  'var(--bg-elev)',
  bgElev2: 'var(--bg-elev-2)',
  bgHover: 'var(--bg-hover)',
  panel:   'var(--panel)',

  // ── Borders ────────────────────────────────────────────────────────────
  line:     'var(--line)',
  lineSoft: 'var(--line-soft)',

  // ── Foreground / text ──────────────────────────────────────────────────
  fg:      'var(--fg)',
  fgMute:  'var(--fg-mute)',
  fgDim:   'var(--fg-dim)',
  fgFaint: 'var(--fg-faint)',

  // ── Status palette ─────────────────────────────────────────────────────
  critical:   'var(--critical)',
  criticalBg: 'var(--critical-bg)',
  high:       'var(--high)',
  highBg:     'var(--high-bg)',
  med:        'var(--med)',
  medBg:      'var(--med-bg)',
  low:        'var(--low)',
  lowBg:      'var(--low-bg)',
  ok:         'var(--ok)',
  okBg:       'var(--ok-bg)',
  info:       'var(--info)',
  infoBg:     'var(--info-bg)',

  // ── Spacing / shape ────────────────────────────────────────────────────
  rowH:        'var(--row-h)',
  rowHCompact: 'var(--row-h-compact)',
  rowHComfy:   'var(--row-h-comfy)',
  radius:      'var(--radius)',
  radiusLg:    'var(--radius-lg)',

  // ── Typography ─────────────────────────────────────────────────────────
  mono: 'var(--mono)',
  sans: 'var(--sans)',
} as const;

export type TokenKey = keyof typeof TOKEN;
