import { useEffect, useState } from 'react';

/**
 * A value that settles rather than tracking every keystroke.
 *
 * For anything a keystroke would otherwise trigger directly — a search, a
 * suggestions lookup — where firing per character means one request per letter
 * and a re-render on each of their replies.
 *
 * Copies of this had accumulated in a handful of components; this is the one
 * to reach for next time.
 */
export function useDebounced<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return settled;
}
