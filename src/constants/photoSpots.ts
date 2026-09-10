/**
 * What kind of place a photo spot is, and what it's good for.
 *
 * Mirrors horacio's `helpers/photoSpotTypes.js`, which is authoritative — it
 * validates on write, and a key that isn't in its list is stored as null. The
 * copy here exists so a chip can be labelled without a round trip; change both
 * together, or fetch `GET /api/photospot/types` if they ever drift.
 *
 * Two axes on purpose. `type` is what the place *is* — you could point at it on
 * a map. `category` is what you'd *shoot* there. The same parking structure is
 * a great night spot and a hopeless one for rollers, and one merged list would
 * force those into a single unusable label.
 */

export interface SpotOption {
  key: string;
  label: string;
  /**
   * The pin's colour for this type.
   *
   * Type rather than category, because the pin has room for exactly one
   * dimension and where a place *is* is the one you're scanning the map for.
   */
  color: string;
}

export const PHOTO_SPOT_TYPES: SpotOption[] = [
  { key: 'garage',       label: 'Parking Garage',    color: '#7C6BD8' },
  { key: 'road',         label: 'Road / Canyon',     color: '#2E9E4F' },
  { key: 'lot',          label: 'Empty Lot',         color: '#9A8F80' },
  { key: 'industrial',   label: 'Industrial',        color: '#C2703D' },
  { key: 'urban',        label: 'Urban / Street',    color: '#3D8BC2' },
  { key: 'nature',       label: 'Nature / Scenic',   color: '#4E8C5A' },
  { key: 'airstrip',     label: 'Airstrip / Runway', color: '#5C5C5C' },
  { key: 'track',        label: 'Track / Circuit',   color: '#E23B3B' },
  { key: 'architecture', label: 'Architecture',      color: '#B0538A' },
  { key: 'other',        label: 'Other',             color: '#8A8A8A' },
];

export const PHOTO_SPOT_CATEGORIES: { key: string; label: string }[] = [
  { key: 'static',      label: 'Statics' },
  { key: 'rolling',     label: 'Rollers' },
  { key: 'panning',     label: 'Panning' },
  { key: 'detail',      label: 'Details' },
  { key: 'night',       label: 'Night / Long Exposure' },
  { key: 'golden_hour', label: 'Golden Hour' },
  { key: 'drone',       label: 'Drone / Aerial' },
  { key: 'group',       label: 'Group Shots' },
];

/** Pins a basic member may keep. Real: horacio refuses the fourth. */
export const PHOTO_SPOT_LIMIT_BASIC = 3;

const TYPE_BY_KEY = new Map(PHOTO_SPOT_TYPES.map((t) => [t.key, t]));
const CATEGORY_BY_KEY = new Map(PHOTO_SPOT_CATEGORIES.map((c) => [c.key, c]));

/** The label for a stored key, or the key itself — never blank. */
export function spotTypeLabel(key?: string | null): string | null {
  if (!key) return null;
  return TYPE_BY_KEY.get(key)?.label ?? key;
}

export function spotCategoryLabel(key?: string | null): string | null {
  if (!key) return null;
  return CATEGORY_BY_KEY.get(key)?.label ?? key;
}

/** The pin colour for a spot's type, falling back to the "other" grey. */
export function spotTypeColor(key?: string | null): string {
  return (key && TYPE_BY_KEY.get(key)?.color) || '#8A8A8A';
}
