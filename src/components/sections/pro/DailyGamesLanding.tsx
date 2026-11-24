import React from 'react';
import { View, ScrollView, StyleSheet, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Countdown from '../../games/Countdown';
import DailyGameTiles from '../../games/DailyGameTiles';
import TodayResults from '../../games/TodayResults';
import { GamesLeaderboard } from './LeaderboardsScreen';
import { useDayTurnover } from '../../games/useDayTurnover';
import {
  HIT, MISS, auctionGrade, gradeWord, isNoGame,
} from '../../games/game';
import {
  useGetCarGameTodayQuery, useGetCarGameStatsQuery, useGetAuctionGameTodayQuery, useGetAuctionGameStatsQuery,
} from '../../../api/apiService';
import { useRefreshControl } from '../../../hooks/useRefreshControl';
import { colors } from '../../../constants/colors';
import {
  GUTTER, COLOR_GRAY_160, COLOR_WHITE,
} from '../../../constants/config';
import { MAX_ATTEMPTS } from '../../../types/games';
import ProSubTabs from '../ProSubTabs';

/** Where today stands in one game, as the button says it. */
export interface Status {
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

export function useCarStatus(): Status & { refetch: () => Promise<unknown> } {
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

export function useAuctionStatus(): Status & { refetch: () => Promise<unknown> } {
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

/**
 * PRO › Games › Today (see GamesScreen): the two games as tiles, each opening
 * its game full screen (DailyGameScreen), then today's results from the other
 * Pro players, a tab per game.
 */
export default function DailyGamesLanding({ scrollRef, headerPad, bottomPad, onScroll }: {
  scrollRef?: React.RefObject<ScrollView | null>;
  headerPad: number;
  bottomPad: number;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const car = useCarStatus();
  const auction = useAuctionStatus();
  const sharedNext = car.nextAt ?? auction.nextAt;
  const refreshControl = useRefreshControl(() => Promise.all([car.refetch(), auction.refetch()]), headerPad);

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[styles.content, { paddingTop: headerPad + 2, paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={refreshControl}
    >
      {/* PRO's options, scrolling away with the page (nothing outside PRO). */}
      {/* Out past the content's padding to the app's gutters. */}
      <View style={{ marginHorizontal: -(GUTTER + 8), marginBottom: -14 }}>
        <ProSubTabs />
      </View>
      <DailyGameTiles />
      {sharedNext ? <Countdown nextAt={sharedNext} label="Resets in" small /> : null}
      <View style={styles.results}><TodayResults /></View>
      {/* The standings, under today's results — all time unless another window's picked. */}
      <View style={styles.results}><GamesLeaderboard /></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER + 8, gap: 14 },
  results: { marginTop: 14 },
});
