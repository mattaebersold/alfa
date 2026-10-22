import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { apiService, useGetLiveSponsoredAuctionsQuery } from '../../api/apiService';
import { useAppDispatch } from '../../store/store';
import { useIsAppActive } from '../../hooks/useIsAppActive';
import { imageUrl } from '../../utils/image';
import {
  COMMON_RADIUS, COLOR_BLACK, COLOR_GRAY_26, COLOR_PRO, COLOR_RED, COLOR_WHITE, GUTTER,
} from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import type { SponsoredAuction, SponsoredAuctionSource } from '../../types/api';

/** How often the live list is re-asked for while the app's open — a new auction turns up within this. */
const LIVE_POLL_MS = 5 * 60_000;

/** The card's least height — room enough for the photo behind it to read as a car. */
const CARD_MIN_H = 104;
const CARD_PAD = 14;

export const AUCTION_SOURCE_LABELS: Record<SponsoredAuctionSource, string | null> = {
  bat: 'Bring a Trailer',
  carsandbids: 'Cars & Bids',
  other: null,
};

/**
 * The time now, ticking once a second while `enabled` — one interval per
 * caller, cleared on unmount. Paused while the app's in the background (a
 * clock in someone's pocket has no one to show), and caught up the moment
 * it's back.
 */
export function useNow(enabled = true): number {
  const active = useIsAppActive();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!enabled || !active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled, active]);
  return now;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "2d 04:12:09", or under a day "04:12:09". Never negative — "00:00:00" once it's over. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const hms = `${pad2(Math.floor((total % 86400) / 3600))}:${pad2(Math.floor((total % 3600) / 60))}:${pad2(total % 60)}`;
  return d > 0 ? `${d}d ${hms}` : hms;
}

/**
 * The society's auctions that are still running, by the clock here rather
 * than the server's — one whose countdown reaches zero drops out on that
 * second, without waiting for the next fetch — and the time they're counted
 * against.
 *
 * Fetched on every mount and polled lightly while the app's open, so an
 * auction the admin adds appears without a restart. When one ends, both
 * lists are refetched: it's gone from the live one and now belongs in the
 * past results.
 */
export function useLiveSponsoredAuctions() {
  const dispatch = useAppDispatch();
  const appActive = useIsAppActive();
  const { data, refetch } = useGetLiveSponsoredAuctionsQuery(undefined, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
    pollingInterval: appActive ? LIVE_POLL_MS : 0,
  });
  const entries = useMemo(() => data?.entries ?? [], [data]);
  const now = useNow(entries.length > 0);
  const live = useMemo(
    () => entries.filter((a) => new Date(a.ends_at).getTime() > now),
    [entries, now],
  );

  // Refetched once per auction that runs out — not on every tick after, if
  // the server's clock is a little behind ours and still counts it live.
  const ended = useRef(new Set<string>());
  useEffect(() => {
    let fresh = false;
    for (const a of entries) {
      if (new Date(a.ends_at).getTime() <= now && !ended.current.has(a.internal_id)) {
        ended.current.add(a.internal_id);
        fresh = true;
      }
    }
    if (fresh) dispatch(apiService.util.invalidateTags(['SponsoredAuction']));
  }, [entries, now, dispatch]);

  return { live, now, refetch };
}

/** The red "LIVE" pill, its dot breathing so it reads as happening now. */
export function LivePill({ style }: { style?: StyleProp<ViewStyle> }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={[styles.livePill, style]}>
      <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
}

/**
 * Time left on an auction: the digits, fixed-width so they don't jostle as
 * they tick, over a small "left". Red in the last hour.
 */
export function AuctionCountdown({ endsAt, now, style }: {
  endsAt: string;
  now: number;
  style?: StyleProp<ViewStyle>;
}) {
  const left = new Date(endsAt).getTime() - now;
  return (
    <View style={[styles.clock, style]}>
      <Text style={[styles.clockDigits, left < 3_600_000 && styles.clockUrgent]} numberOfLines={1}>
        {formatCountdown(left)}
      </Text>
      <Text style={styles.clockLabel}>left</Text>
    </View>
  );
}

function BannerCard({ auction, now }: { auction: SponsoredAuction; now: number }) {
  const cover = imageUrl(auction.images?.[0]);
  const left = new Date(auction.ends_at).getTime() - now;
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => Linking.openURL(auction.url).catch(() => {})}
      activeOpacity={0.85}
      accessibilityRole="link"
      accessibilityLabel={`View the Open Road Society's live auction now: ${auction.title}, ${formatCountdown(left)} left`}
    >
      {/* The cover across the whole card, the car showing clear on the
          left; from 10% across it fades into the card's grey, where the
          words sit. */}
      {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
      <LinearGradient
        colors={COVER_FADE.colors}
        locations={COVER_FADE.locations}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LivePill style={styles.badge} />
      <View style={styles.text}>
        <View style={styles.eyebrow}>
          <Text style={styles.eyebrowText} numberOfLines={1}>Open Road Society Auction</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{auction.title}</Text>
        <View style={styles.foot}>
          {/* Time left, in its own pill so it reads over any photo. Red in the last hour. */}
          <View style={styles.timePill}>
            <Text style={[styles.timeText, left < 3_600_000 && styles.clockUrgent]} numberOfLines={1}>
              {formatCountdown(left)}
            </Text>
          </View>
          {/* Looks like a button; the whole card is the tap. */}
          <View style={styles.viewPill}>
            <Text style={styles.viewText}>View</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * The top of the home feed, above the guessing game: the Open Road
 * Society's own auction while it's live, a card across the row for each,
 * counting down to its end and opening the listing on a tap.
 *
 * Nothing at all when there's no auction running — a card whose clock runs
 * out goes on that second.
 */
export default function LiveAuctionBanner() {
  const { live, now, refetch } = useLiveSponsoredAuctions();

  // Back on the feed from elsewhere in the app — mount alone doesn't cover a
  // tab that stays mounted.
  useFocusEffect(React.useCallback(() => { refetch(); }, [refetch]));

  if (!live.length) return null;
  return (
    <View style={styles.wrap}>
      {live.map((a) => <BannerCard key={a.internal_id} auction={a} now={now} />)}
    </View>
  );
}

/**
 * Across the whole card: clear over its first 10%, then easing all the way to
 * the card's grey (COLOR_GRAY_26) at its right edge. The clear end is the same
 * grey at no opacity, so the fade doesn't pass through a muddy darker band.
 */
const COVER_FADE = {
  colors: ['rgba(26,26,26,0)', COLOR_GRAY_26] as const,
  locations: [0.1, 1] as const,
};

const styles = StyleSheet.create({
  // A little clear of the header's tabs above, as the row under it is.
  wrap: { paddingTop: 12, paddingHorizontal: GUTTER, gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    minHeight: CARD_MIN_H, padding: CARD_PAD,
    borderRadius: COMMON_RADIUS, backgroundColor: COLOR_GRAY_26, overflow: 'hidden',
  },
  badge: { position: 'absolute', top: 10, left: 10 },
  // The right half, set against the card's right edge; the photo has the left.
  text: { width: '50%', gap: 6, alignItems: 'flex-end' },
  eyebrow: {
    alignSelf: 'flex-end', maxWidth: '100%',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
    backgroundColor: COLOR_PRO,
  },
  eyebrowText: { fontSize: 10, lineHeight: 14, fontFamily: FONT_INTER.bold, color: COLOR_BLACK },
  title: { fontSize: 14, lineHeight: 18, fontFamily: FONT_INTER.extrabold, color: COLOR_WHITE, textAlign: 'right' },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 2 },
  timePill: {
    flexShrink: 1, height: 24, paddingHorizontal: 9, borderRadius: 999, justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  timeText: { fontSize: 12, lineHeight: 15, fontFamily: FONT_INTER.bold, color: COLOR_WHITE, fontVariant: ['tabular-nums'] },
  // The time pill's height exactly — both 24, borders inside it.
  viewPill: {
    height: 24, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center',
    backgroundColor: COLOR_BLACK,
  },
  viewText: { fontSize: 12, lineHeight: 15, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },

  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 18, paddingHorizontal: 6, borderRadius: 999, backgroundColor: COLOR_RED,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLOR_WHITE },
  liveText: { fontSize: 10, lineHeight: 12, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.6, color: COLOR_WHITE },

  clock: { alignItems: 'flex-end', flexShrink: 0 },
  clockDigits: {
    fontSize: 15, lineHeight: 19, fontFamily: FONT_INTER.bold, color: COLOR_WHITE,
    fontVariant: ['tabular-nums'],
  },
  clockUrgent: { color: COLOR_RED },
  clockLabel: { fontSize: 11, lineHeight: 14, fontFamily: FONT_INTER.semibold, color: 'rgba(255,255,255,0.5)' },
});
