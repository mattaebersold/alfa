import {
  COLOR_BLACK,
  COLOR_GRAY_141,
  COLOR_GREEN,
  COLOR_HUE_CLAY,
  COLOR_HUE_CORNFLOWER,
  COLOR_HUE_LAVENDER,
  COLOR_HUE_ORCHID,
  COLOR_HUE_RASPBERRY,
  COLOR_HUE_ROSE,
  COLOR_HUE_SEAFOAM,
  COLOR_HUE_STEEL,
  COLOR_PRIMARY,
  COLOR_PRO,
  COLOR_TANGERINE,
  COLOR_WHITE,
} from '../constants/config';
/**
 * A stable colour per content category, for the pills on record and post rows.
 *
 * Named entries cover the categories that actually turn up, so the common ones
 * read consistently — maintenance always green, restoration always amber. The
 * hash fallback means a category added server-side still gets its own colour
 * rather than defaulting to grey, and gets the *same* one on every render.
 */
const CATEGORY_COLORS: Record<string, string> = {
  mod:           COLOR_PRIMARY,
  restoration:   COLOR_TANGERINE,
  maintenance:   COLOR_GREEN,
  detailing:     COLOR_HUE_ORCHID,
  show:          COLOR_PRO,
  meets:         COLOR_HUE_SEAFOAM,
  announcements: COLOR_HUE_RASPBERRY,
  general:       COLOR_HUE_STEEL,
  misc:          COLOR_GRAY_141,
  other:         COLOR_GRAY_141,
};

const FALLBACK_HUES = [COLOR_HUE_CORNFLOWER, COLOR_HUE_CLAY, COLOR_HUE_SEAFOAM, COLOR_HUE_ROSE, COLOR_HUE_LAVENDER];

export function categoryColor(key?: string): string {
  if (!key) return COLOR_GRAY_141;
  const named = CATEGORY_COLORS[key];
  if (named) return named;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return FALLBACK_HUES[hash % FALLBACK_HUES.length];
}

/** Black or white, whichever the pill's fill can actually carry. */
export function pillTextColor(bg: string): string {
  const m = bg.match(/^#([0-9a-f]{6})$/i);
  if (!m) return COLOR_BLACK;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // Rec. 601 luma — good enough to pick a side, and cheap.
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? COLOR_BLACK : COLOR_WHITE;
}
