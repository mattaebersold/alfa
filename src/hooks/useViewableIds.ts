import { useCallback, useRef, useState } from 'react';
import type { ViewToken } from 'react-native';

/**
 * How much of a row has to be on screen to count as being watched.
 *
 * The same numbers FeedList uses, for the same reasons: 60% rather than a token
 * sliver, because a video half off the top of the screen is something you've
 * scrolled past; `minimumViewTime` so a fast flick doesn't start and stop
 * players on every row it passes.
 */
export const VIEWABILITY = { itemVisiblePercentThreshold: 60, minimumViewTime: 150 };

/**
 * Which rows of a FlatList are on screen, so a post's video can stop when its
 * card scrolls away.
 *
 * FeedList does this inline for its mixed rows; this is the same thing for the
 * plainer lists of posts elsewhere — a profile's posts, an event's, your own on
 * the dashboard — so each doesn't grow its own copy. Spread `listProps` onto the
 * FlatList and pass `isVisible(id)` to the card's `visible`.
 *
 * `idOf` is read through a ref because RN treats `onViewableItemsChanged` as
 * fixed for the life of the list and throws if its identity changes.
 */
export function useViewableIds<T>(idOf: (item: T) => string | null | undefined) {
  const [visibleIds, setVisibleIds] = useState<ReadonlySet<string>>(() => new Set());
  const idOfRef = useRef(idOf);
  idOfRef.current = idOf;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const next = new Set<string>();
    viewableItems.forEach((v) => {
      const id = v.item ? idOfRef.current(v.item as T) : null;
      if (id) next.add(id);
    });
    setVisibleIds(next);
  }).current;

  const isVisible = useCallback((id: string | null | undefined) => !!id && visibleIds.has(id), [visibleIds]);

  return {
    listProps: { viewabilityConfig: VIEWABILITY, onViewableItemsChanged },
    isVisible,
  };
}
