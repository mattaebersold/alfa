import { useCallback, useState } from 'react';

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
export function usePosterRatio(
  initial?: number,
  /**
   * The two shapes to pick between. The defaults suit a feed; a garage card
   * wants the taller pair (3:2 and 2:3), since it's more picture than card.
   */
  shapes: { landscape: number; portrait: number } = { landscape: LANDSCAPE, portrait: PORTRAIT },
) {
  const [ratio, setRatio] = useState(initial ?? shapes.landscape);

  const onLoad = useCallback((e: { source?: { width?: number; height?: number } | null }) => {
    const w = e.source?.width;
    const h = e.source?.height;
    if (!w || !h) return;
    // Square counts as wide: a wide card crops a square photo less than a
    // tall one does, and reads as the common case.
    setRatio(h > w ? shapes.portrait : shapes.landscape);
  }, [shapes.landscape, shapes.portrait]);

  return { ratio, onLoad };
}
