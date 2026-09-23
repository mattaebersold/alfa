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
  { key: 'garage',     label: 'Parking Garage',  color: '#7C6BD8' },
  { key: 'road',       label: 'Road / Canyon',   color: '#2E9E4F' },
  { key: 'urban',      label: 'Urban / Street',  color: '#3D8BC2' },
  { key: 'industrial', label: 'Industrial',      color: '#C2703D' },
  { key: 'nature',     label: 'Scenic / Nature', color: '#4E8C5A' },
  { key: 'track',      label: 'Track / Airstrip', color: '#E23B3B' },
  { key: 'other',      label: 'Other',           color: '#8A8A8A' },
];

/**
 * Keys from the ten-type list this replaced, and where each went: a lot is
 * an industrial setting to a camera, architecture is urban, an airstrip
 * shoots like a track. Spots pinned under them keep their stored key; the
 * label and colour resolve through here. Mirrors horacio's LEGACY_TYPES.
 */
const LEGACY_TYPES: Record<string, string> = {
  lot: 'industrial',
  architecture: 'urban',
  airstrip: 'track',
};

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

/**
 * The pin itself, on the map.
 *
 * One colour for every pin, chosen to stand off the tiles: the type colours
 * above are tints that vanish into a map, and a pin's first job is to be
 * seen. The type still shows as the ring around the avatar on Android and in
 * the summary's badge. Mirrors PIN_FILL in horacio's services/avatarPin.js,
 * which draws the Android pin; change both.
 */
export const PHOTO_SPOT_PIN_COLOR = '#F0198C';

/** Pins a basic member may keep. Real: horacio refuses the fourth. */
export const PHOTO_SPOT_LIMIT_BASIC = 3;

const TYPE_BY_KEY = new Map(PHOTO_SPOT_TYPES.map((t) => [t.key, t]));
const CATEGORY_BY_KEY = new Map(PHOTO_SPOT_CATEGORIES.map((c) => [c.key, c]));

/** A stored type's entry in today's list, following an old key to its new home. */
const typeFor = (key?: string | null) =>
  key ? TYPE_BY_KEY.get(LEGACY_TYPES[key] ?? key) : undefined;

/** The label for a stored key, or the key itself — never blank. */
export function spotTypeLabel(key?: string | null): string | null {
  if (!key) return null;
  return typeFor(key)?.label ?? key;
}

export function spotCategoryLabel(key?: string | null): string | null {
  if (!key) return null;
  return CATEGORY_BY_KEY.get(key)?.label ?? key;
}

/** The pin colour for a spot's type, falling back to the "other" grey. */
export function spotTypeColor(key?: string | null): string {
  return typeFor(key)?.color || '#8A8A8A';
}
