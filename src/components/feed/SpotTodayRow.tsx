import React, { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import Avatar from '../ui/Avatar';
import RowEndSpacer from '../ui/RowEndSpacer';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { UPCOMING_CARD_WIDTH } from '../cards/UpcomingCard';
import SpotDaySummaryModal, { SPOT_GAMES } from './SpotDaySummaryModal';
import { HIT, MISS } from './SpotResultBody';
import { useColors } from '../../hooks/useColors';
import { useGetSpotFeedTodayQuery, useGetLoggedInUserQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { SOURCE_APPS, openSourceApp, sourceAppFallback } from '../../constants/sourceApps';
import { imageUrl } from '../../utils/image';
import {
  COMMON_RADIUS, COLOR_BLACK, COLOR_GRAY_26, COLOR_GRAY_38, COLOR_SHEEN_GOLD, COLOR_WHITE, GUTTER,
} from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import type { SpotDayGames, SpotFeedToday, SpotGameKind } from '../../types/api';

type Player = SpotFeedToday['players'][number];

/** "Wed, Oct 14" — the day these plays are for. */
const todayLabel = () =>
  new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * Square thumbnail edge, and so the card's height. Shorter than the events
 * carousel's 110: this row is a glance at who's played, at the very top of
 * the feed, and shouldn't push the posts down. 84 still holds the chips, the
 * name and "Played today" inside the text column's padding.
 */
const THUMB = 84;
const CARD_GAP = 12;

/** A game's chip colour on a card: how it went, or grey for one not played. */
function chipColor(game: SpotGameKind, day: SpotDayGames): string | null {
  if (game === 'car') return day.car ? (day.car.won ? HIT : MISS) : null;
  if (game === 'trivia') return day.trivia ? (day.trivia.correct ? HIT : MISS) : null;
  if (!day.auction) return null;
  return day.auction.bullseye ? HIT : day.auction.score >= 50 ? COLOR_SHEEN_GOLD : MISS;
}

/**
 * One member who played today: their photo as the square, then the three
 * games as chips — green, red, or grey for one they skipped — and their name.
 * The events carousel's card, so the two rows read as the same kind of thing.
 */
function PlayerCard({ player, onPress, full = false }: {
  player: Player;
  onPress: (origin: SummaryOrigin | null) => void;
  /** Across the row rather than a carousel card's width — the only one today. */
  full?: boolean;
}) {
  const { user } = player;
  const photo = imageUrl(user.gallery?.[0]?.filename ?? user.profilePicture);
  const chips = (
    <View style={styles.chips}>
      {SPOT_GAMES.map(({ key, Icon }) => {
        const color = chipColor(key, player);
        return (
          <View key={key} style={[styles.chip, { backgroundColor: color ?? COLOR_GRAY_38 }]}>
            <Icon size={15} color={color ? COLOR_BLACK : 'rgba(255,255,255,0.4)'} strokeWidth={2.4} />
          </View>
        );
      })}
    </View>
  );
  return (
    <SummaryTouchable
      style={[styles.card, full ? styles.cardFull : { width: UPCOMING_CARD_WIDTH }]}
      onPress={onPress}
      accessibilityLabel={`${user.username} played the ORS Guessing Game today`}
    >
      <View style={styles.thumb}>
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <Avatar user={user} size={THUMB} radius={0} />
        )}
      </View>
      {/* Stacked in a carousel card, chips over the name. Full width there's
          room to lay it out flat: the name centred in the card's height, the
          chips at its right end. */}
      <View style={[styles.text, full && styles.textFull]}>
        {!full && chips}
        <View style={styles.foot}>
          <Text style={styles.title} numberOfLines={1}>{user.username}</Text>
          <Text style={styles.meta} numberOfLines={1}>Played today</Text>
        </View>
      </View>
      {full && chips}
    </SummaryTouchable>
  );
}

/**
 * The top of the home feed: the members you follow who've played Car
 * Spotter's games today, one card each, opening their day against yours.
 *
 * Today only — the server answers for the game's own day, so yesterday's
 * players are gone at midnight — and nothing at all until someone you follow
 * has played. Refetched on focus and on the feed's pull to refresh, since it
 * fills up through the day.
 */
export default function SpotTodayRow() {
  const colors = useColors();
  const { data, refetch } = useGetSpotFeedTodayQuery();
  const [open, setOpen] = useState<{ player: Player; origin: SummaryOrigin | null } | null>(null);

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  // Whether you're a Car Spotter player at all — missing `accounts` is an
  // account from before the field, which is ORS-only (see SpotResultBody).
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const { data: me } = useGetLoggedInUserQuery(undefined, { skip: !myId });
  const hasSpot = !!me?.accounts?.includes('spot');
  // Any of today's three counts as having played.
  const played = !!(data?.me?.car || data?.me?.trivia || data?.me?.auction);
  const cta = !me ? null
    : !hasSpot
      ? { label: 'Get the app', onPress: () => { Linking.openURL(sourceAppFallback(SOURCE_APPS.spot)).catch(() => {}); } }
      : !played
        ? { label: 'Play', onPress: () => { openSourceApp(SOURCE_APPS.spot); } }
        : null;

  const players = data?.players ?? [];
  if (!players.length) return null;

  return (
    <View style={styles.wrap}>
      {/* The game's name, with the day it's for in a badge beside it — these
          cards are today's only and gone at midnight. */}
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.fg }]} numberOfLines={1}>ORS Guessing Game</Text>
        <View style={styles.headEnd}>
          <View style={[styles.dateBadge, { borderColor: colors.border }]}>
            <Text style={[styles.dateText, { color: colors.fg }]}>{todayLabel()}</Text>
          </View>
          {/* The date's pill, as a button: today's games to play, or the app
              to get first. Gone once you've played. */}
          {cta && (
            <TouchableOpacity
              style={[styles.dateBadge, styles.ctaBadge]}
              onPress={cta.onPress}
              activeOpacity={0.8}
              hitSlop={6}
              accessibilityRole="button"
            >
              <Text style={[styles.dateText, styles.ctaText]}>{cta.label}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {/* One player is one card across the row — a lone carousel card left
          most of the row empty beside it, and nothing to scroll to. */}
      {players.length === 1 ? (
        <View style={styles.single}>
          <PlayerCard full player={players[0]} onPress={(origin) => setOpen({ player: players[0], origin })} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
          snapToInterval={UPCOMING_CARD_WIDTH + CARD_GAP}
          snapToAlignment="start"
          decelerationRate="fast"
        >
          {players.map((p) => (
            <PlayerCard key={p.user.user_id} player={p} onPress={(origin) => setOpen({ player: p, origin })} />
          ))}
          <RowEndSpacer />
        </ScrollView>
      )}

      <SpotDaySummaryModal
        player={open?.player ?? null}
        me={data?.me ?? null}
        origin={open?.origin}
        onClose={() => setOpen(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // A little clear of the header's tabs above.
  wrap: { paddingTop: 12, paddingBottom: 14 },
  sectionHead: {
    // The title on the left, the date pinned to the right edge.
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingHorizontal: GUTTER, paddingBottom: 10,
  },
  sectionTitle: { flexShrink: 1, fontSize: 16, fontFamily: FONT_INTER.bold },
  // A set height, not padding around the text: the date and the button
  // beside it share this, and padding left them a hair apart.
  dateBadge: {
    height: 26, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dateText: { fontSize: 12.5, lineHeight: 16, fontFamily: FONT_INTER.bold },
  // Never squeezed — the title gives way instead.
  headEnd:  { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  // The date pill filled in the game's gold, so it reads as the thing to tap.
  ctaBadge: { backgroundColor: COLOR_SHEEN_GOLD, borderColor: COLOR_SHEEN_GOLD },
  ctaText:  { color: COLOR_BLACK },
  carousel: { paddingLeft: GUTTER, gap: CARD_GAP, alignItems: 'flex-start' },
  // The lone card: the carousel's start gutter, and the same on the right.
  single:   { paddingHorizontal: GUTTER },
  cardFull: { alignSelf: 'stretch' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 11, paddingRight: 10,
    borderRadius: COMMON_RADIUS, overflow: 'hidden', backgroundColor: COLOR_GRAY_26,
  },
  thumb: {
    width: THUMB, height: THUMB,
    borderTopRightRadius: COMMON_RADIUS, borderBottomRightRadius: COMMON_RADIUS, overflow: 'hidden',
    backgroundColor: COLOR_GRAY_38,
  },
  text: { flex: 1, minWidth: 0, height: THUMB, paddingVertical: 10, justifyContent: 'space-between' },
  textFull: { justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: 5 },
  chip: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  foot: { gap: 1 },
  title: { fontSize: 13.5, lineHeight: 17, fontFamily: FONT_INTER.extrabold, color: COLOR_WHITE },
  meta: { fontSize: 12, lineHeight: 15, fontFamily: FONT_INTER.semibold, color: 'rgba(255,255,255,0.6)' },
});
