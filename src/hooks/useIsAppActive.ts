import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Whether the app is in the foreground.
 *
 * RTK Query's `pollingInterval` has no notion of the app being backgrounded — it
 * keeps firing requests at a phone sitting in someone's pocket. Gating the
 * interval on this stops the timer while the app is away and restarts it on
 * return, which matters most for the short intervals: a thread polling every
 * eight seconds is 450 pointless requests an hour otherwise.
 */
export function useIsAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setActive(next === 'active'));
    return () => sub.remove();
  }, []);

  return active;
}
