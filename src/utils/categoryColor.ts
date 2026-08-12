/**
 * A stable colour per content category, for the pills on record and post rows.
 *
 * Named entries cover the categories that actually turn up, so the common ones
 * read consistently — maintenance always green, restoration always amber. The
 * hash fallback means a category added server-side still gets its own colour
 * rather than defaulting to grey, and gets the *same* one on every render.
 */
const CATEGORY_COLORS: Record<string, string> = {
  mod:           '#25A2D3',
  restoration:   '#FA7921',
  maintenance:   '#85C27D',
  detailing:     '#B57EDC',
  show:          '#CDA96F',
  meets:         '#5CB8A8',
  announcements: '#D65C7A',
  general:       '#7A8798',
  misc:          '#8D8D8D',
  other:         '#8D8D8D',
};

const FALLBACK_HUES = ['#5C8FD6', '#D67A5C', '#5CB8A8', '#C05C8E', '#9A8FD6'];

export function categoryColor(key?: string): string {
  if (!key) return '#8D8D8D';
  const named = CATEGORY_COLORS[key];
  if (named) return named;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return FALLBACK_HUES[hash % FALLBACK_HUES.length];
}

/** Black or white, whichever the pill's fill can actually carry. */
export function pillTextColor(bg: string): string {
  const m = bg.match(/^#([0-9a-f]{6})$/i);
  if (!m) return '#000000';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // Rec. 601 luma — good enough to pick a side, and cheap.
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000000' : '#FFFFFF';
}
