// Static color constants mirroring tailwind.config.js
// Use these in StyleSheet.create() where NativeWind classes can't be used
// (e.g., navigator tabBarStyle, react-native-maps styles)

export const colors = {
  // Brand
  brg:       '#191919',
  brgDark:   '#0A0A0A',
  brgLight:  '#252525',

  // Accent
  cyan:      '#23cfb8',
  speed:     '#23cfb8',
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
