import { COLOR_BADGE_DEFAULT, COLOR_BADGE_EVENT, COLOR_BADGE_GARAGE, COLOR_BADGE_GROUP, COLOR_BADGE_LISTING, COLOR_BADGE_RECORD, COLOR_BADGE_SPOT, COLOR_BADGE_UPDATE, COLOR_BADGE_WANT, COLOR_BLACK, COLOR_CATEGORY_ACCESSORIES, COLOR_CATEGORY_CAR, COLOR_CATEGORY_DETAILING, COLOR_CATEGORY_MAINTENANCE, COLOR_CATEGORY_MISC, COLOR_CATEGORY_MOD, COLOR_CATEGORY_MUSEUM, COLOR_CATEGORY_NEW, COLOR_CATEGORY_PART, COLOR_CATEGORY_RESTORATION, COLOR_CATEGORY_SHOW, COLOR_CATEGORY_USED, COLOR_CATEGORY_WILD, COLOR_CREAM, COLOR_GOLD, COLOR_GRAY_10, COLOR_GRAY_102, COLOR_GRAY_13, COLOR_GRAY_141, COLOR_GRAY_170, COLOR_GRAY_20, COLOR_GRAY_211, COLOR_GRAY_214, COLOR_GRAY_224, COLOR_GRAY_240, COLOR_GRAY_25, COLOR_GRAY_30, COLOR_GRAY_32, COLOR_GRAY_60, COLOR_GRAY_64, COLOR_GRAY_96, COLOR_GREEN, COLOR_GUARDS_RED, COLOR_LINK_BLUE, COLOR_PRIMARY, COLOR_PRO, COLOR_PRO_DARK, COLOR_RED, COLOR_SECONDARY, COLOR_SLATE, COLOR_SPOTTER_GREEN, COLOR_TANGERINE, COLOR_TEAL, COLOR_WHITE } from './config';
// Static color constants mirroring tailwind.config.js
// Use these in StyleSheet.create() where NativeWind classes can't be used
// (e.g., navigator tabBarStyle, react-native-maps styles)

export const colors = {
  // Brand
  brg:       COLOR_GRAY_25,
  brgDark:   COLOR_GRAY_10,
  brgLight:  COLOR_GRAY_32,

  // Accent
  // Hex, not `rgb()`. A dozen places tint these by appending an alpha pair —
  // `primaryAlt + '22'` — which is valid on a hex string and nonsense on an
  // `rgb(...)` one, so every one of those tints was silently rendering as a
  // solid fill. Same colours, in the notation the rest of the app assumes.
  primaryAlt: COLOR_PRIMARY,
  primaryPro: COLOR_PRO_DARK,
  pro:       COLOR_PRO,
  guards:    COLOR_GUARDS_RED,
  tangerine: COLOR_TANGERINE,
  green:     COLOR_GREEN,

  // Semantic
  cream:     COLOR_CREAM,
  bg:        COLOR_CREAM,
  bgDark:    COLOR_GRAY_25,
  fg:        COLOR_GRAY_20,
  fgDark:    COLOR_GRAY_224,
  border:    COLOR_GRAY_170,
  borderDark:COLOR_GRAY_60,
  muted:     COLOR_GRAY_64,
  secondary: COLOR_SECONDARY,
  inputBg:   COLOR_WHITE,
  inputBgDark: COLOR_GRAY_13,
  inputBorder: COLOR_GRAY_96,
  segment:   COLOR_GRAY_240,
  segmentDark: COLOR_GRAY_30,

  // Surfaces
  card:      COLOR_WHITE,
  // Grays
  grey:      COLOR_GRAY_141,
  greyDark:  COLOR_GRAY_102,
  greyLight: COLOR_GRAY_211,

  // Status
  red:       COLOR_RED,
  gold:      COLOR_GOLD,
  teal:      COLOR_TEAL,
  blue:      COLOR_SLATE,
  // The blue that reads as a link on a dark ground — `blue` above is a slate
  // used as a surface, not as text.
  blueLight: COLOR_LINK_BLUE,

  // Badges
  badgeListing: COLOR_BADGE_LISTING,
  badgeWant:    COLOR_BADGE_WANT,
  badgeGarage:  COLOR_BADGE_GARAGE,
  badgeEvent:   COLOR_BADGE_EVENT,
  badgeGroup:   COLOR_BADGE_GROUP,
  badgeRecord:  COLOR_BADGE_RECORD,
  badgeDefault: COLOR_BADGE_DEFAULT,
  badgeSpot:    COLOR_BADGE_SPOT,
  badgeUpdate:  COLOR_BADGE_UPDATE,
  badgeUpdateFg: COLOR_WHITE,
  badgeFg:      COLOR_BLACK,
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
  // Car Spotter's own green, so the badge matches the game's grid.
  spot_result: { bg: COLOR_SPOTTER_GREEN,      fg: COLOR_WHITE },
  update:   { bg: colors.badgeUpdate,  fg: colors.badgeUpdateFg },
  post:     { bg: colors.badgeDefault, fg: colors.badgeFg },
  default:  { bg: colors.badgeDefault, fg: colors.badgeFg },
};

// Softer pastel palette for the secondary "category" badge, so it reads as a
// sub-tag next to the vivid primary type badge.
export const CATEGORY_BADGE_COLORS: Record<string, { bg: string; fg: string }> = {
  // general
  show:         { bg: COLOR_CATEGORY_SHOW, fg: COLOR_BLACK },
  misc:         { bg: COLOR_CATEGORY_MISC, fg: COLOR_BLACK },
  general:      { bg: COLOR_BADGE_DEFAULT, fg: COLOR_BLACK },
  // record
  mod:          { bg: COLOR_CATEGORY_MOD, fg: COLOR_BLACK },
  restoration:  { bg: COLOR_CATEGORY_RESTORATION, fg: COLOR_BLACK },
  maintenance:  { bg: COLOR_CATEGORY_MAINTENANCE, fg: COLOR_BLACK },
  detailing:    { bg: COLOR_CATEGORY_DETAILING, fg: COLOR_BLACK },
  // listing
  new:          { bg: COLOR_CATEGORY_NEW, fg: COLOR_BLACK },
  used:         { bg: COLOR_CATEGORY_USED, fg: COLOR_BLACK },
  accessories:  { bg: COLOR_CATEGORY_ACCESSORIES, fg: COLOR_BLACK },
  // want / listing shared
  car:          { bg: COLOR_CATEGORY_CAR, fg: COLOR_BLACK },
  part:         { bg: COLOR_CATEGORY_PART, fg: COLOR_BLACK },
  other:        { bg: COLOR_GRAY_214, fg: COLOR_BLACK },
  // spot
  museum:       { bg: COLOR_CATEGORY_MUSEUM, fg: COLOR_BLACK },
  wild:         { bg: COLOR_CATEGORY_WILD, fg: COLOR_BLACK },
  default:      { bg: COLOR_GRAY_224, fg: COLOR_BLACK },
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
