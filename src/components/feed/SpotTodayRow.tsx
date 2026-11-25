import React, { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '../../theme/Text';
import { ChevronRight } from 'lucide-react-native';
import { Image } from '../ui/AppImage';
import { useFocusEffect } from '@react-navigation/native';
import Avatar from '../ui/Avatar';
import RowEndSpacer from '../ui/RowEndSpacer';
import { HEADER_GUTTER } from '../ui/AppHeader';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { UPCOMING_CARD_WIDTH } from '../cards/UpcomingCard';
import SpotDaySummaryModal, { SPOT_GAMES } from './SpotDaySummaryModal';
import { HIT, MISS } from './SpotResultBody';
import { useColors } from '../../hooks/useColors';
import { useGetSpotFeedTodayQuery } from '../../api/apiService';
import { useIsPro } from '../../hooks/useBrandColor';
import { useAppSelector } from '../../store/store';
import { openDailyGames } from '../games/openDailyGames';
import { imageUrl } from '../../utils/image';
import {
  COMMON_RADIUS, COLOR_BLACK, COLOR_GRAY_38, COLOR_SHEEN_GOLD, COLOR_WHITE, SURFACE_MID
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

/** A game's chip colour on a card: how it went, or null for one not played. */
function chipColor(game: SpotGameKind, day: SpotDayGames): string | null {
  if (game === 'car') return day.car ? (day.car.won ? HIT : MISS) : null;
  if (!day.auction) return null;
  return day.auction.bullseye ? HIT : day.auction.score >= 50 ? COLOR_SHEEN_GOLD : MISS;
}

/**
 * One member who played today: their photo as the square, then the games
 * they played as chips — green or red — and their name.
 * The events carousel's card, so the two rows read as the same kind of thing.
 */
function PlayerCard({ player, onPress, full = false, self = false }: {
  player: Player;
  /** Your own card — said so to a screen reader. */
  self?: boolean;
  onPress: (origin: SummaryOrigin | null) => void;
  /** Across the row rather than a carousel card's width — the only one today. */
  full?: boolean;
}) {
  const { user } = player;
  const photo = imageUrl(user.gallery?.[0]?.filename ?? user.profilePicture, 'thumb');
  const chips = (
    <View style={styles.chips}>
      {/* Only the games they played — a skipped one has nothing to say. */}
      {SPOT_GAMES.map(({ key, Icon }) => {
        const color = chipColor(key, player);
        if (!color) return null;
        return (
          <View key={key} style={[styles.chip, { backgroundColor: color }]}>
            <Icon size={15} color={COLOR_BLACK} strokeWidth={2.4} />
          </View>
        );
      })}
    </View>
  );
  return (
    <SummaryTouchable
      style={[styles.card, full ? styles.cardFull : { width: UPCOMING_CARD_WIDTH }]}
      onPress={onPress}
      accessibilityLabel={self ? 'You played the Daily Games today' : `${user.username} played the Daily Games today`}
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
 * The top of the home feed: the Pro members who've played the PRO tab's
 * Daily Games today, one card each, opening their day against yours —
 * yours among them, first, once you've played (it opens your day alone).
 * The server leaves you out of `players` and sends your day as `me`, so
 * your card is made here from that and your own profile.
 *
 * Pro members only, like the games — nothing at all for anyone else, and the
 * server only answers a Pro member. Today only (yesterday's players are gone
 * at midnight), and nothing until someone has played. Refetched on focus,
 * since it fills up through the day.
 */
export default function SpotTodayRow() {
  const colors = useColors();
  const isPro = useIsPro();
  const { data, refetch } = useGetSpotFeedTodayQuery(undefined, { skip: !isPro });
  const myself = useAppSelector((s) => s.auth.userInfo);
  const [open, setOpen] = useState<{ player: Player; origin: SummaryOrigin | null; self?: boolean } | null>(null);

  useFocusEffect(useCallback(() => { if (isPro) refetch(); }, [isPro, refetch]));

  // Either of today's games counts as having played.
  const played = !!(data?.me?.car || data?.me?.auction);
  const cta = !played ? { label: 'Play', onPress: openDailyGames } : null;

  // Your card, first, once you've played — the others' day is what they
  // played, and yours belongs in the row with it.
  const mine: Player | null = played && myself && data?.me
    ? { user: myself, ...data.me, played_at: null }
    : null;
  const others = data?.players ?? [];
  const players = mine ? [mine, ...others.filter((p) => p.user.user_id !== mine.user.user_id)] : others;
  const isMine = (p: Player) => p === mine;
  if (!isPro || !players.length) return null;

  return (
    <View style={styles.wrap}>
      {/* The game's name, with the day it's for in a badge beside it — these
          cards are today's only and gone at midnight. */}
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.fg }]} numberOfLines={1}>Daily Games</Text>
        <View style={styles.headEnd}>
          <View style={[styles.dateBadge, { borderColor: colors.border }]}>
            <Text style={[styles.dateText, { color: colors.fg }]}>{todayLabel()}</Text>
          </View>
          {/* The date's pill, as a button: today's games, on the PRO tab.
              Gone once you've played. */}
          {cta && (
            <TouchableOpacity
              style={[styles.dateBadge, styles.ctaBadge, { borderColor: colors.border }]}
              onPress={cta.onPress}
              activeOpacity={0.8}
              hitSlop={6}
              accessibilityRole="button"
            >
              <Text style={[styles.dateText, { color: colors.fg }]}>{cta.label}</Text>
              <ChevronRight size={14} color={colors.fg} strokeWidth={2.6} style={styles.ctaChevron} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {/* One player is one card across the row — a lone carousel card left
          most of the row empty beside it, and nothing to scroll to. */}
      {players.length === 1 ? (
        <View style={styles.single}>
          <PlayerCard full self={isMine(players[0])} player={players[0]} onPress={(origin) => setOpen({ player: players[0], origin, self: isMine(players[0]) })} />
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
            <PlayerCard key={p.user.user_id} self={isMine(p)} player={p} onPress={(origin) => setOpen({ player: p, origin, self: isMine(p) })} />
          ))}
          <RowEndSpacer />
        </ScrollView>
      )}

      <SpotDaySummaryModal
        player={open?.player ?? null}
        me={data?.me ?? null}
        self={!!open?.self}
        origin={open?.origin}
        onClose={() => setOpen(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // A little clear of the header's tabs above.
  wrap: { paddingTop: 4, paddingBottom: 14 },
  sectionHead: {
    // The title on the left, the date pinned to the right edge.
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingHorizontal: HEADER_GUTTER, paddingBottom: 10,
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
  // The date pill's look, with a chevron after the label to say it goes somewhere.
  ctaBadge:   { flexDirection: 'row', gap: 2, paddingRight: 7 },
  ctaChevron: { marginTop: 1 },
  carousel: { paddingLeft: HEADER_GUTTER, gap: CARD_GAP, alignItems: 'flex-start' },
  // The lone card: the carousel's start gutter, and the same on the right.
  single:   { paddingHorizontal: HEADER_GUTTER },
  cardFull: { alignSelf: 'stretch' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 11, paddingRight: 10,
    borderRadius: COMMON_RADIUS, overflow: 'hidden', backgroundColor: SURFACE_MID,
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
