import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Refetch a query each time the screen is returned to.
 *
 * RTK Query's tag invalidation covers the case where the acting screen and the
 * showing screen are alive at the same time, but a screen that was left behind
 * — pushed under a stack, or unmounted and rebuilt from a cache entry — can
 * still be showing an answer from before the user changed something elsewhere.
 * Approving a join request from the notifications list and then walking back to
 * the group is exactly that shape.
 *
 * The first focus is skipped: that's the mount, which the query itself already
 * fetches, and refetching there would double every screen entry.
 */
export function useRefetchOnFocus(refetch: () => unknown) {
  const seenFirstFocus = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (seenFirstFocus.current) refetch();
      else seenFirstFocus.current = true;
    }, [refetch]),
  );
}
