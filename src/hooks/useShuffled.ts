import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { shuffle } from '../utils/array';

/**
 * `items` in a random order — a new one each time the screen comes into view.
 *
 * Shuffling once per mount wasn't enough for a row on a tab: the tab stays
 * mounted all session and the cached list keeps its identity, so the order
 * was the same on every visit until the app restarted. Held still while the
 * screen is in view, so a scroll or a refetch doesn't reorder it under you.
 */
export function useShuffled<T>(items: readonly T[] | undefined): T[] {
  const [visit, setVisit] = useState(0);
  useFocusEffect(useCallback(() => { setVisit((v) => v + 1); }, []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => shuffle(items ?? []), [items, visit]);
}
