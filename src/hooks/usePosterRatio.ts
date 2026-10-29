import { useCallback, useRef, useState } from 'react';

/** Landscape and portrait: the only two shapes a poster card takes. */
export const LANDSCAPE = 4 / 3;
export const PORTRAIT = 3 / 4;

/**
 * Pick a card's shape from the photograph in it.
 *
 * A fixed ratio crops whichever half of the library it doesn't suit: at 4:3 a
 * portrait photo loses its top and bottom, which on a car is usually the car.
 * Two shapes cover it — wide photos get a wide card, tall photos get a tall
 * one — and picking between them from the image's own proportions costs
 * nothing, because the load event already carries them.
 *
 * Only two, not the photo's exact ratio: a feed of cards each at its own
 * arbitrary height reads as a broken column, and a panorama would be a letter
 * slot. These are the bounds, and `cover` handles the rest.
 *
 * Starts landscape, which is what most car photography is, so the common case
 * never moves. A card that does change shape does it on the frame the image
 * appears, which reads as the picture arriving rather than as a reflow.
 */
/**
 * Each photo's own width over height, once it's been seen — so a card that
 * leaves the screen and comes back (a grid drops the far-off ones; see
 * MasonryGrid) returns at its shape, not the default it starts at, and the
 * cards below don't jump while you scroll up.
 */
const SEEN = new Map<string, number>();

export function usePosterRatio(
  initial?: number,
  /**
   * The two shapes to pick between. The defaults suit a feed; a garage card
   * wants the taller pair (3:2 and 2:3), since it's more picture than card.
   */
  shapes: { landscape: number; portrait: number } = { landscape: LANDSCAPE, portrait: PORTRAIT },
  /**
   * The photo's own ratio, not the nearer of the two — for a two-column
   * mosaic, where cards of different heights are the point and a rounded
   * shape only crops the picture. `shapes.landscape` is still the start.
   */
  exact = false,
  /** The photo's URL, to start at the shape it was last seen at. */
  key?: string | null,
) {
  // Square counts as wide: a wide card crops a square photo less than a
  // tall one does, and reads as the common case.
  const shapeOf = (aspect: number) => (exact ? aspect : aspect < 1 ? shapes.portrait : shapes.landscape);
  const [ratio, setRatio] = useState(() => {
    const seen = key ? SEEN.get(key) : undefined;
    return seen ? shapeOf(seen) : initial ?? shapes.landscape;
  });

  // Settled once per photo. iOS decodes the picture to the size of its view
  // (AppImage's enforceEarlyResizing), so reshaping the card can load it again
  // — at a size whose ratio is off from the last by a pixel's rounding. Taking
  // every load at its word, an exact card never stopped changing shape.
  const settled = useRef<string | null>(null);

  const onLoad = useCallback((e: { source?: { width?: number; height?: number } | null }) => {
    const w = e.source?.width;
    const h = e.source?.height;
    if (!w || !h) return;
    // Only a keyed photo can be known as the same one; without a key (a
    // panel reused from car to car) every load may be a new picture.
    if (key) {
      if (settled.current === key) return;
      settled.current = key;
      if (!SEEN.has(key)) SEEN.set(key, w / h);
    }
    const next = shapeOf(key ? SEEN.get(key)! : w / h);
    // A hair's difference isn't a new shape: keep the card where it is.
    setRatio((prev) => (Math.abs(prev - next) / next < 0.02 ? prev : next));
  }, [exact, shapes.landscape, shapes.portrait, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ratio, onLoad };
}
