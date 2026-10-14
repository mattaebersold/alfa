import React, { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
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
import { useGetSpotFeedTodayQuery } from '../../api/apiService';
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

/** Square thumbnail edge — the events carousel's, so the two rows are one size. */
const THUMB = 110;
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
function PlayerCard({ player, onPress }: { player: Player; onPress: (origin: SummaryOrigin | null) => void }) {
  const { user } = player;
  const photo = imageUrl(user.gallery?.[0]?.filename ?? user.profilePicture);
  return (
    <SummaryTouchable
      style={[styles.card, { width: UPCOMING_CARD_WIDTH }]}
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
      <View style={styles.text}>
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
        <View style={styles.foot}>
          <Text style={styles.title} numberOfLines={1}>{user.username}</Text>
          <Text style={styles.meta} numberOfLines={2}>Played today</Text>
        </View>
      </View>
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

  const players = data?.players ?? [];
  if (!players.length) return null;

  return (
    <View style={styles.wrap}>
      {/* The game's name on the left, and the day it's for on the right — a
          badge, since these cards are today's only and gone at midnight. */}
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.fg }]} numberOfLines={1}>ORS Guessing Game</Text>
        <View style={[styles.dateBadge, { borderColor: colors.border }]}>
          <Text style={[styles.dateText, { color: colors.fg }]}>{todayLabel()}</Text>
        </View>
      </View>
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
  wrap: { paddingTop: 6, paddingBottom: 14 },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: GUTTER, paddingBottom: 10,
  },
  sectionTitle: { flexShrink: 1, fontSize: 16, fontFamily: FONT_INTER.bold },
  dateBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dateText: { fontSize: 12.5, fontFamily: FONT_INTER.bold },
  carousel: { paddingLeft: GUTTER, gap: CARD_GAP, alignItems: 'flex-start' },

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
  chips: { flexDirection: 'row', gap: 5 },
  chip: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  foot: { gap: 1 },
  title: { fontSize: 13.5, lineHeight: 17, fontFamily: FONT_INTER.extrabold, color: COLOR_WHITE },
  meta: { fontSize: 12, lineHeight: 15, fontFamily: FONT_INTER.semibold, color: 'rgba(255,255,255,0.6)' },
});
