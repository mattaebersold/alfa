// Static color constants mirroring tailwind.config.js
// Use these in StyleSheet.create() where NativeWind classes can't be used
// (e.g., navigator tabBarStyle, react-native-maps styles)

export const colors = {
  // Brand
  brg:       '#191919',
  brgDark:   '#0A0A0A',
  brgLight:  '#202020',

  // Accent
  primaryAlt:'rgb(37, 162, 211)',
  primaryPro: 'rgb(196, 160, 92)',
  pro:       '#CDA96F',
  guards:    '#D00000',
  tangerine: '#FA7921',
  green:     '#85C27D',

  // Semantic
  cream:     '#F5EFED',
  bg:        '#F5EFED',
  bgDark:    '#191919',
  fg:        '#141414',
  fgDark:    '#E0E0E0',
  border:    '#AAAAAA',
  borderDark:'#3C3C3C',
  muted:     '#404040',
  secondary: '#DDD8D6',
  inputBg:   '#FFFFFF',
  inputBgDark: '#0D0D0D',
  inputBorder: '#606060',
  segment:   '#F0F0F0',
  segmentDark: '#1E1E1E',

  // Surfaces
  card:      '#FFFFFF',
  // Grays
  grey:      '#8D8D8D',
  greyDark:  '#666666',
  greyLight: '#D3D3D3',

  // Status
  red:       '#EC4632',
  gold:      '#C1911B',
  teal:      '#01777A',
  blue:      '#2F3A4C',

  // Badges
  badgeListing: '#00FF3F',
  badgeWant:    '#F1184C',
  badgeGarage:  '#FF479C',
  badgeEvent:   '#FFFB38',
  badgeGroup:   '#F89CFA',
  badgeRecord:  '#35B5FF',
  badgeDefault: '#F0D689',
  badgeSpot:    '#F36943',
  badgeUpdate:  '#2E9599',
  badgeUpdateFg: '#FFFFFF',
  badgeFg:      '#000000',
} as const;

export type ColorKey = keyof typeof colors;

// Badge variant → background color mapping
export const BADGE_COLORS: Record<string, { bg: string; fg: string }> = {
  listing:  { bg: colors.badgeListing, fg: colors.badgeFg },
  'want-ad':{ bg: colors.badgeWant,    fg: colors.badgeFg },
  want:     { bg: colors.badgeWant,    fg: colors.badgeFg },
  wants:    { bg: colors.badgeWant,    fg: colors.badgeFg },
  garage:   { bg: colors.badgeGarage,  fg: colors.badgeFg },
  event:    { bg: colors.badgeEvent,   fg: colors.badgeFg },
  group:    { bg: colors.badgeGroup,   fg: colors.badgeFg },
  record:   { bg: colors.badgeRecord,  fg: colors.badgeFg },
  spotted:  { bg: colors.badgeSpot,    fg: colors.badgeFg },
  update:   { bg: colors.badgeUpdate,  fg: colors.badgeUpdateFg },
  post:     { bg: colors.badgeDefault, fg: colors.badgeFg },
  default:  { bg: colors.badgeDefault, fg: colors.badgeFg },
};

// Softer pastel palette for the secondary "category" badge, so it reads as a
// sub-tag next to the vivid primary type badge.
export const CATEGORY_BADGE_COLORS: Record<string, { bg: string; fg: string }> = {
  // general
  show:         { bg: '#B39DFF', fg: '#000000' },
  misc:         { bg: '#CFD3D6', fg: '#000000' },
  general:      { bg: '#F0D689', fg: '#000000' },
  // record
  mod:          { bg: '#7FD4FF', fg: '#000000' },
  restoration:  { bg: '#FFB59B', fg: '#000000' },
  maintenance:  { bg: '#8FD9DC', fg: '#000000' },
  detailing:    { bg: '#8FE6D8', fg: '#000000' },
  // listing
  new:          { bg: '#7CFF9E', fg: '#000000' },
  used:         { bg: '#F6E4AE', fg: '#000000' },
  accessories:  { bg: '#FBC8FC', fg: '#000000' },
  // want / listing shared
  car:          { bg: '#FFFD9E', fg: '#000000' },
  part:         { bg: '#9FDCFF', fg: '#000000' },
  other:        { bg: '#D6D6D6', fg: '#000000' },
  // spot
  museum:       { bg: '#E6C860', fg: '#000000' },
  wild:         { bg: '#B6DFA0', fg: '#000000' },
  default:      { bg: '#E0E0E0', fg: '#000000' },
};

/**
 * A palette colour at a given alpha.
 *
 * Gradients have to fade to a *transparent version of the destination colour*,
 * not to plain `transparent` — that interpolates through transparent black and
 * leaves a grey cast partway down the ramp.
 */
export function withAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
