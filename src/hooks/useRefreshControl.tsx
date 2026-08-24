import React, { useCallback, useRef, useState } from 'react';
import { RefreshControl, type RefreshControlProps } from 'react-native';
import { useColors } from './useColors';

/**
 * Pull-to-refresh, as one line per screen.
 *
 * Every scrollable screen wants the same three things — a `refreshing` flag, an
 * async handler that clears it, and a `RefreshControl` tinted to the brand — and
 * hand-rolling them screen by screen is how half of them ended up without any.
 * This returns the finished element:
 *
 *     const refreshControl = useRefreshControl(refetch);
 *     <FlatList refreshControl={refreshControl} … />
 *
 * A screen with several queries passes one function that awaits them together:
 *
 *     useRefreshControl(() => Promise.all([refetchA(), refetchB()]))
 *
 * The callback is read from a ref, so a caller can pass a fresh closure every
 * render (the common case — `() => Promise.all([...])`) without the handler
 * changing identity or the deps needing to be listed.
 */
export function useRefreshControl(
  refetch: () => unknown,
  /**
   * Where the spinner appears, for screens whose list scrolls under a floating
   * header. Without it the spinner comes down behind the header bar on Android.
   */
  offset?: number,
  // Typed as a RefreshControl element specifically — `ReactElement` on its own
  // is not what FlatList/ScrollView's `refreshControl` prop accepts.
): React.ReactElement<RefreshControlProps> {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(refetch);
  latest.current = refetch;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await latest.current();
    } catch {
      // A refresh that fails leaves the screen showing what it already had,
      // which is the honest outcome — the one thing it must not do is leave the
      // spinner turning forever.
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.primaryAlt}
      colors={[colors.primaryAlt]}
      {...(offset ? { progressViewOffset: offset } : {})}
    />
  );
}
