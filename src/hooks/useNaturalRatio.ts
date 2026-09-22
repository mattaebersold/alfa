import { useCallback, useState } from 'react';
import { clampCardRatio } from '../constants/eventTypes';

/**
 * A card's shape, taken from the photograph in it.
 *
 * The event and rally cards show a photo whole rather than cropped to a frame:
 * event art is a poster or a flyer as often as it is a photograph, and a fixed
 * frame cut the lettering off the top of one and the cars off the bottom of
 * the other. Unlike `usePosterRatio`, which picks one of two shapes to keep a
 * feed column even, this keeps the real ratio — a row of event cards is
 * top-aligned and a column of them is a list, so ragged heights read as photos
 * being photos.
 *
 * Bounded (see `clampCardRatio`) so a panorama isn't a letter slot and a
 * phone-portrait isn't most of a screen. Holds `fallback` until the photo has
 * decoded, and for cards with no photo at all, so a list doesn't start ragged.
 */
export function useNaturalRatio(fallback: number) {
  const [ratio, setRatio] = useState(fallback);
  const onAspectRatio = useCallback((r: number) => setRatio(clampCardRatio(r)), []);
  return { ratio, onAspectRatio };
}
