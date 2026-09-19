import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useGetMarketplaceUnreadCountQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useIsAppActive } from '../../hooks/useIsAppActive';
import { CONFIG } from '../../constants/config';
import { colors } from '../../constants/colors';
import { PILL_RADIUS } from '../../constants/radius';

/** Past this the badge stops counting and starts saying "lots" — as the bell does. */
export const BADGE_MAX = 10;

/**
 * How many marketplace messages are waiting, and which listings they're about.
 *
 * Polled on the bell's interval rather than the thread's: this is a badge that
 * needs to be roughly current, not a conversation in progress. Gated on the app
 * being in the foreground for the same reason every other poll here is — see
 * useIsAppActive.
 *
 * Deliberately separate from `useGetUnreadMessageCountQuery`. The inbox's count
 * is an unscoped count over models/Message and knows nothing about listings;
 * this one is counted off the marketplace threads. Neither number can move the
 * other, which is exactly the product decision: a message about a wheel set
 * must not make the inbox look like it has mail in it.
 */
export function useMarketplaceUnread() {
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const appActive = useIsAppActive();

  const { data } = useGetMarketplaceUnreadCountQuery(undefined, {
    skip: !isLoggedIn,
    pollingInterval: appActive ? CONFIG.NOTIFICATION_POLL_INTERVAL : 0,
  });

  const byListing = data?.by_listing ?? [];

  return {
    count: data?.count ?? 0,
    /** How many conversations carry those messages, for "3 people are waiting". */
    threads: data?.threads ?? 0,
    byListing,
    /** Unread about one listing — what a row in "manage your listings" shows. */
    countForListing: (listingId: string) =>
      byListing.find((l) => l.listing_id === listingId)?.count ?? 0,
  };
}

/**
 * The red bubble, drawn the way the notifications bell draws its own.
 *
 * Presentational: the count comes from the caller, because a screen that needs
 * it usually needs the breakdown too and shouldn't pay for two subscriptions.
 *
 * `floating` pins it to the top-right of whatever it's inside — an icon, a tab
 * — and needs a positioned parent. Inline is for a row that has room for it.
 */
export default function MarketplaceUnreadBadge({
  count,
  variant = 'floating',
  style,
}: {
  count: number;
  variant?: 'floating' | 'inline';
  style?: StyleProp<ViewStyle>;
}) {
  // Nothing waiting is nothing to say — an empty bubble reads as a zero.
  if (count <= 0) return null;

  return (
    <View
      style={[styles.badge, variant === 'floating' && styles.floating, style]}
      accessibilityLabel={`${count} unread marketplace ${count === 1 ? 'message' : 'messages'}`}
    >
      <Text style={styles.text}>{count > BADGE_MAX ? `${BADGE_MAX}+` : count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 19, height: 19, borderRadius: PILL_RADIUS,
    paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.red,
  },
  // Over the corner of whatever it marks. zIndex and elevation both, because
  // the two platforms decide stacking differently — see NotificationsBell.
  floating: {
    position: 'absolute', top: -6, right: -8,
    zIndex: 10, elevation: 12,
  },
  text: { fontSize: 10.5, fontWeight: '800', color: '#FFFFFF' },
});
