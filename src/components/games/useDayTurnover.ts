import { useEffect } from 'react';
import { AppState } from 'react-native';

/**
 * Keeps a view of today's game on today's game: refetches when the app comes
 * back, and just past midnight (`nextAt`, the server's next day boundary).
 * `fetchedAt` re-arms the timer after every fetch.
 */
export function useDayTurnover(nextAt: string | undefined, fetchedAt: number | undefined, refetch: () => void) {
  // A phone left open overnight should come back to the new game.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refetch(); });
    return () => sub.remove();
  }, [refetch]);

  // Aimed a moment past the boundary and re-armed on every fetch: a phone
  // clock ahead of the server's gets the same `next_at` back and asks again.
  useEffect(() => {
    if (!nextAt) return;
    const boundary = new Date(nextAt).getTime();
    if (!Number.isFinite(boundary)) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const left = boundary + 2000 - Date.now();
      if (left <= 0) {
        refetch();
        return;
      }
      // In steps of at most a minute, rather than one timer hours long.
      timer = setTimeout(tick, Math.min(left, 60_000));
    };
    const past = Date.now() >= boundary;
    timer = setTimeout(tick, past ? 30_000 : 0);
    return () => clearTimeout(timer);
  }, [nextAt, fetchedAt, refetch]);
}
