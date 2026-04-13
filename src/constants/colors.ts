// Static color constants mirroring tailwind.config.js
// Use these in StyleSheet.create() where NativeWind classes can't be used
// (e.g., navigator tabBarStyle, react-native-maps styles)

export const Colors = {
  // Brand
  brg:       '#1C3738',
  brgDark:   '#142627',
  brgLight:  '#254A4B',

  // Accent
  cyan:      '#08DEE3',
  speed:     '#FEB829',
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

export type ColorKey = keyof typeof Colors;

// Badge variant → background color mapping
export const BADGE_COLORS: Record<string, { bg: string; fg: string }> = {
  listing:  { bg: Colors.badgeListing, fg: Colors.badgeFg },
  'want-ad':{ bg: Colors.badgeWant,    fg: Colors.badgeFg },
  want:     { bg: Colors.badgeWant,    fg: Colors.badgeFg },
  wants:    { bg: Colors.badgeWant,    fg: Colors.badgeFg },
  garage:   { bg: Colors.badgeGarage,  fg: Colors.badgeFg },
  event:    { bg: Colors.badgeEvent,   fg: Colors.badgeFg },
  group:    { bg: Colors.badgeGroup,   fg: Colors.badgeFg },
  record:   { bg: Colors.badgeRecord,  fg: Colors.badgeFg },
  spotted:  { bg: Colors.badgeSpot,    fg: Colors.badgeFg },
  update:   { bg: Colors.badgeUpdate,  fg: Colors.badgeUpdateFg },
  post:     { bg: Colors.badgeDefault, fg: Colors.badgeFg },
  default:  { bg: Colors.badgeDefault, fg: Colors.badgeFg },
};
