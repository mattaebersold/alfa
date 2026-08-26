/**
 * The colour behind a member's initials when they have no photo.
 *
 * A mirror of horacio's helpers/avatarColor.js — same palette, same hash, same
 * order — so a member whose record predates the `avatarColor` field still gets
 * the exact colour the server would have stamped on them. That's what lets the
 * feature ship without waiting on a backfill: `user.avatarColor` wins when it's
 * there, and this fills in when it isn't.
 *
 * Keep the two files in step. Reordering the palette here alone would repaint
 * every un-stamped member and leave the stamped ones where they were.
 */
export const AVATAR_COLORS = [
  '#8E3B46', // brick
  '#A64B2A', // rust
  '#9C6644', // saddle
  '#8A6B1F', // ochre
  '#5B7B3A', // olive
  '#2E6B4F', // pine
  '#1F6F6B', // teal
  '#2B5F7E', // slate blue
  '#3F4E8C', // indigo
  '#5D4A8C', // violet
  '#7A3E77', // plum
  '#A03A63', // magenta
  '#7A4A3A', // umber
  '#4A5A6B', // steel
];

/**
 * FNV-1a over the seed. `Math.imul` keeps the multiply in 32-bit, which is what
 * makes this produce the same number here as it does on the server; `>>> 0`
 * keeps it unsigned so the modulo can't come back negative.
 */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The palette colour for a member, keyed off their user_id. */
export function avatarColorFor(seed?: string | null): string {
  return AVATAR_COLORS[hashSeed(String(seed ?? '')) % AVATAR_COLORS.length];
}

/**
 * The one or two characters that stand in for a member's face.
 *
 * A first and last initial where the name is on hand, because that's what a
 * person recognises themselves by. Falls back to the handle — sliced rather
 * than split on spaces, since a username is one token — and finally to '?'
 * rather than an empty circle.
 */
export function initialsFor({ firstName, lastName, username, name }: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  /** Whatever the caller had — a display name, a handle, anything. */
  name?: string | null;
}): string {
  const first = firstName?.trim()?.[0];
  const last = lastName?.trim()?.[0];
  if (first || last) return `${first ?? ''}${last ?? ''}`.toUpperCase();

  const handle = (username ?? name ?? '').replace(/^@/, '').trim();
  if (!handle) return '?';

  // A name with a space in it is two words worth initialling; a handle isn't,
  // so it gives up its first two characters instead.
  const words = handle.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  }
  return handle.slice(0, 2).toUpperCase();
}
