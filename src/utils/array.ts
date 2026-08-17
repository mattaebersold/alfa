/**
 * Fisher-Yates, returning a new array.
 *
 * Used by the feed's suggestion rows, where the point is that two visits don't
 * show the same ten faces in the same order — the candidate pool is far larger
 * than the shelf, so without a shuffle the same handful of people would win
 * every time simply by being newest.
 *
 * Call it inside a `useMemo` keyed on the source data, not in render: an
 * unmemoised shuffle reorders on every re-render, which turns a scroll into a
 * slot machine.
 */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
