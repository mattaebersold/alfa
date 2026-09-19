import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLazyGetMarketplaceThreadsQuery } from '../../api/apiService';
import type { AppStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

export type StartListingThreadOptions = {
  /** Shown in the conversation's header until the thread's own snapshot lands. */
  listingTitle?: string;
  /** Prefills the composer — "Is this still available?" from a quick action. */
  initialBody?: string;
};

/**
 * "Get in touch about this listing."
 *
 * The one entry point into marketplace messaging from the browse side, so a
 * listing card, a detail panel and a search result all behave identically:
 *
 *     const { startThread, isStarting } = useStartListingThread();
 *     <Button disabled={isStarting} onPress={() => startThread(listing.internal_id)} />
 *
 * It opens the conversation screen; it does not create anything. Nothing is
 * written until the buyer actually sends a message — pressing "message seller"
 * and thinking better of it should leave no trace on the seller's list.
 *
 * Reuse is the server's job: `POST /threads` looks up (listing_id, buyer_id)
 * and returns the existing conversation rather than opening a rival one, and
 * the unique index behind it makes that true under a double tap rather than
 * merely usually true.
 *
 * The lookup here is only about what the screen opens *on*. A buyer who has
 * asked before should land in the conversation they already have, with its
 * history, rather than on an empty composer that fills in a moment later — so
 * their thread for this listing is asked for first, and `isStarting` is that
 * wait. It's an optimisation, not a precondition: a failed or slow lookup
 * still opens the composer, and the screen repeats the search itself (off the
 * same cache entry, so it costs nothing twice).
 *
 * Deliberately a hook rather than a navigate() at each call site: the route
 * name and its params stay in one file, and the day this becomes a sheet
 * instead of a screen, nothing on the browse side has to change.
 */
export function useStartListingThread() {
  const navigation = useNavigation<NavProp>();
  const [findThreads] = useLazyGetMarketplaceThreadsQuery();
  const [isStarting, setIsStarting] = useState(false);

  // The button that started this is usually inside a panel that closes on the
  // way out, so the state it is waiting on can outlive it.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const startThread = useCallback(async (listingId: string, opts?: StartListingThreadOptions) => {
    if (!listingId) return;
    setIsStarting(true);

    let threadId: string | undefined;
    try {
      // As the buyer: that's the only side that can open a conversation, and
      // the seller reaches theirs from their own list with an id in hand.
      // `true` prefers a cached answer, so a second press is instant.
      const found = await findThreads(
        { listing_id: listingId, role: 'as_buyer', limit: 1 },
        true,
      ).unwrap();
      threadId = found.entries?.[0]?.internal_id;
    } catch {
      // Offline, or the lookup failed. The composer is still the right screen.
    }

    if (mounted.current) setIsStarting(false);

    navigation.navigate('MarketplaceThread', threadId
      ? { threadId, listingId, listingTitle: opts?.listingTitle, initialBody: opts?.initialBody }
      : { listingId, listingTitle: opts?.listingTitle, initialBody: opts?.initialBody });
  }, [findThreads, navigation]);

  return { startThread, isStarting };
}

export default useStartListingThread;
