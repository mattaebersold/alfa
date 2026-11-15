/**
 * The Open Road Society palette, as alfa ships it.
 *
 * Dark only. `primaryAlt` is the basic member's blue and `pro` the Pro red;
 * `useColors` swaps one for the other so a screen written against `primaryAlt`
 * follows the account without asking. Hex throughout — a dozen places tint
 * these by appending an alpha pair (`primaryAlt + '22'`), which only works on a
 * hex string.
 */
export const colors = {
  brg:       '#262626',
  brgDark:   '#000000',
  brgLight:  '#262626',

  primaryAlt: '#36B2E2',
  primaryPro: '#CE4F4F',
  // The Pro red — the one place it's set. alfa's COLOR_PRO reads it from here.
  pro:       '#FF5F6A',
  proLight:  '#F7CE8C',
  proDark:   '#82683F',
  guards:    '#D00000',
  tangerine: '#FA7921',
  green:     '#85C27D',
  success:   '#2FA84F',

  // Surfaces — alfa's three: black #000000, dark #161616 (grounds), mid
  // #262626 (cards). See SURFACE_* in alfa's constants/config.
  cream:     '#161616',
  bg:        '#161616',
  segment:   '#262626',
  secondary: '#282828',
  card:      '#262626',
  fg:        '#E0E0E0',
  muted:     '#A0A0A0',
  border:    '#2E2E2E',
  borderStrong: '#3C3C3C',
  inputBg:   '#000000',
  inputBorder: '#555555',

  grey:      '#B4B4B4',
  greyDark:  '#666666',
  greyLight: '#D3D3D3',

  red:       '#EC4632',
  /** Waiting on you: count bubbles, unread dots, LIVE. alfa's COLOR_ALERT. */
  alert:     '#3AA9EA',
  gold:      '#C1911B',
  teal:      '#01777A',
  blue:      '#2F3A4C',
  blueLight: '#6FC3EC',
} as const;

export type ThemeColors = { [K in keyof typeof colors]: string };

/**
 * A palette colour at a given alpha. Gradients have to fade to a transparent
 * version of the destination colour, not plain `transparent`, or they pass
 * through grey on the way.
 */
export function withAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Perceived brightness (0–255) of a `#rrggbb` colour. */
export function perceivedBrightness(color: string): number {
  const hex = color.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return 0;
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/** Readable text for something sitting on `bg`: black on gold, white on dark. */
export function contrastText(bg: string): '#FFFFFF' | '#000000' {
  return perceivedBrightness(bg) < 140 ? '#FFFFFF' : '#000000';
}
