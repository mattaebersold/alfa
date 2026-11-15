import React, { useCallback } from 'react';
import { View, ScrollView, Pressable, StyleSheet, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronRight } from 'lucide-react-native';
import { Text } from '../../../theme/Text';
import Countdown from '../../games/Countdown';
import { StreakBadge } from '../../games/GameStats';
import { useDayTurnover } from '../../games/useDayTurnover';
import {
  DAILY_GAMES, HIT, MISS, auctionGrade, gradeWord, isNoGame, nextLabel,
} from '../../games/game';
import {
  useGetCarGameTodayQuery, useGetCarGameStatsQuery, useGetAuctionGameTodayQuery, useGetAuctionGameStatsQuery,
} from '../../../api/apiService';
import { useRefreshControl } from '../../../hooks/useRefreshControl';
import { colors } from '../../../constants/colors';
import {
  COMMON_RADIUS, GUTTER, COLOR_GRAY_160, COLOR_WHITE, SURFACE_BLACK, SURFACE_MID,
} from '../../../constants/config';
import { MAX_ATTEMPTS, type DailyGameKind } from '../../../types/games';

/** Where today stands in one game, as the button says it. */
interface Status {
  /** "Not played yet", "Won in 3/5", "7/10 · Close", "No game today". */
  label: string;
  /** The label's colour: green for a win, red for a loss, white to play, grey for none. */
  tone: string;
  /** A little more, under it — the record so far. */
  record: string | null;
  streak: number;
  nextAt?: string;
  /** Still loading — the button holds its shape with no words yet. */
  loading: boolean;
}

function useCarStatus(): Status & { refetch: () => Promise<unknown> } {
  const today = useGetCarGameTodayQuery();
  const { data: stats, refetch: refetchStats } = useGetCarGameStatsQuery();
  useDayTurnover(today.data?.next_at, today.fulfilledTimeStamp, today.refetch);
  const play = today.data?.play;
  const none = isNoGame(today.error) || (today.data && !today.data.puzzle);
  const label = none ? 'No game today'
    : today.isError ? 'Couldn’t load today’s game'
    : !play ? 'Not played yet'
    : play.status === 'playing' ? `In progress · guess ${play.attempts + 1} of ${MAX_ATTEMPTS}`
    : play.status === 'won' ? `Won in ${play.attempts}/${MAX_ATTEMPTS}`
    : 'Stumped';
  const tone = none || today.isError ? COLOR_GRAY_160
    : play?.status === 'won' ? HIT : play?.status === 'lost' ? MISS : COLOR_WHITE;
  return {
    label, tone,
    record: stats?.played ? `${stats.played} played · ${Math.round(stats.win_rate)}% won` : null,
    streak: stats?.current_streak ?? 0,
    nextAt: today.data?.next_at,
    loading: today.isLoading,
    refetch: () => Promise.all([today.refetch(), refetchStats()]),
  };
}

function useAuctionStatus(): Status & { refetch: () => Promise<unknown> } {
  const today = useGetAuctionGameTodayQuery();
  const { data: stats, refetch: refetchStats } = useGetAuctionGameStatsQuery();
  useDayTurnover(today.data?.next_at, today.fulfilledTimeStamp, today.refetch);
  const play = today.data?.play;
  const none = isNoGame(today.error) || (today.data && !today.data.puzzle);
  const grade = play ? auctionGrade(play.score, play.bullseye) : null;
  const label = none ? 'No game today'
    : today.isError ? 'Couldn’t load today’s game'
    : grade == null ? 'Not played yet'
    : `${grade}/10 · ${gradeWord(grade)}`;
  const tone = none || today.isError ? COLOR_GRAY_160
    : grade == null ? COLOR_WHITE : grade >= 7 ? HIT : grade >= 4 ? colors.pro : MISS;
  return {
    label, tone,
    record: stats?.played ? `${stats.played} played · avg ${Math.round(stats.average_score)} · best ${stats.best_score}` : null,
    streak: stats?.current_streak ?? 0,
    nextAt: today.data?.next_at,
    loading: today.isLoading,
    refetch: () => Promise.all([today.refetch(), refetchStats()]),
  };
}

/** One game's big button: what it is, how today went, and when the next one comes. */
function GameButton({ game, status, nextAt, onPress }: {
  game: (typeof DAILY_GAMES)[number];
  status: Status;
  /** Either game's boundary — they're the same — for when this one's today 404'd. */
  nextAt?: string;
  onPress: () => void;
}) {
  const { Icon } = game;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${game.label}. ${status.label}`}
    >
      <View style={styles.buttonTop}>
        <View style={styles.iconTile}>
          <Icon size={30} color={colors.pro} strokeWidth={2} />
        </View>
        <View style={styles.titleCol}>
          <Text style={styles.title}>{game.label}</Text>
          <Text style={styles.blurb}>{game.blurb}</Text>
        </View>
        {status.streak > 0 ? <StreakBadge streak={status.streak} small /> : null}
        <ChevronRight size={22} color={COLOR_GRAY_160} />
      </View>

      <View style={styles.statusBox}>
        <Text style={[styles.status, { color: status.tone }]} numberOfLines={1}>
          {status.loading ? ' ' : status.label}
        </Text>
        {status.record ? <Text style={styles.record} numberOfLines={1}>{status.record}</Text> : null}
        {nextAt ? <View style={styles.countdown}><Countdown nextAt={nextAt} label={nextLabel(game.value)} small /></View> : null}
      </View>
    </Pressable>
  );
}

/**
 * PRO › Daily Games, a Pro member's landing on the PRO tab: one big button
 * per game, saying how today went and when the next one comes. Each opens
 * today's game full screen (DailyGameScreen). A day with nothing scheduled
 * says so here; Past Games and Leaderboards still work.
 */
export default function DailyGamesLanding({ scrollRef, headerPad, bottomPad, onScroll }: {
  scrollRef?: React.RefObject<ScrollView | null>;
  headerPad: number;
  bottomPad: number;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const navigation = useNavigation<any>();
  const car = useCarStatus();
  const auction = useAuctionStatus();
  const status: Record<DailyGameKind, Status> = { car, auction };
  const sharedNext = car.nextAt ?? auction.nextAt;
  const refreshControl = useRefreshControl(() => Promise.all([car.refetch(), auction.refetch()]), headerPad);
  const open = useCallback((game: DailyGameKind) => navigation.navigate('DailyGame', { game }), [navigation]);

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[styles.content, { paddingTop: headerPad + 12, paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={refreshControl}
    >
      <Text style={styles.intro}>A new car and a new auction every day. Play today’s, or catch up in Past Games.</Text>
      {DAILY_GAMES.map((g) => (
        <GameButton
          key={g.value}
          game={g}
          status={status[g.value]}
          nextAt={status[g.value].nextAt ?? sharedNext}
          onPress={() => open(g.value)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER + 8, gap: 14 },
  intro: { color: COLOR_GRAY_160, fontSize: 14, lineHeight: 20, paddingHorizontal: 4 },
  button: {
    backgroundColor: SURFACE_MID, borderRadius: COMMON_RADIUS, padding: 16, gap: 14,
    // The Pro red, faintly, around each — the PRO tab's accent.
    borderWidth: 1, borderColor: `${colors.pro}55`,
  },
  pressed: { opacity: 0.8 },
  buttonTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: {
    width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: SURFACE_BLACK,
  },
  titleCol: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: COLOR_WHITE, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  blurb: { color: COLOR_GRAY_160, fontSize: 13 },
  statusBox: { backgroundColor: SURFACE_BLACK, borderRadius: COMMON_RADIUS - 6, paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  status: { fontSize: 16, fontWeight: '700' },
  record: { color: COLOR_GRAY_160, fontSize: 12.5, fontWeight: '500' },
  countdown: { marginTop: 4 },
});
