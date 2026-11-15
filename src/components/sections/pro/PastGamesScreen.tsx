import React, { useMemo, useState } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import EmptyState from '../../ui/EmptyState';
import Spinner from '../../ui/Spinner';
import { CarDayRow, AuctionDayRow } from '../../games/DayRows';
import { CarStatsSummary, AuctionStatsSummary } from '../../games/GameStats';
import GamePicker from './GamePicker';
import {
  useGetCarGameDaysInfiniteQuery, useGetAuctionGameDaysInfiniteQuery,
  useGetCarGameStatsQuery, useGetAuctionGameStatsQuery,
} from '../../../api/apiService';
import { useRefreshControl } from '../../../hooks/useRefreshControl';
import { GUTTER, COLOR_WHITE } from '../../../constants/config';
import type { AuctionDay, CarDay, DailyGameKind } from '../../../types/games';
import type { SectionScreenProps } from '../types';

/**
 * A game's pages of days, newest first, de-duplicated: a refetch after
 * midnight pushes every page boundary along by one.
 */
function useDays<D extends { play_date: string }>(pages?: { days?: D[] }[]) {
  return useMemo(() => {
    const seen = new Set<string>();
    const out: D[] = [];
    for (const page of pages ?? []) {
      for (const d of page.days ?? []) {
        if (seen.has(d.play_date)) continue;
        seen.add(d.play_date);
        out.push(d);
      }
    }
    return out;
  }, [pages]);
}

type Row = { kind: 'car'; day: CarDay } | { kind: 'auction'; day: AuctionDay };

/**
 * PRO › Past Games: every day so far of one game, newest first — played,
 * missed or still going — under that game's record. Any day opens full
 * screen, to play it late or look back on it; today's is today's game.
 * Ported from Car Spotter's History screen.
 */
export default function PastGamesScreen({ headerPad, onScroll, bottomPad }: SectionScreenProps) {
  const navigation = useNavigation<any>();
  const [game, setGame] = useState<DailyGameKind>('car');
  const isCar = game === 'car';

  const car = useGetCarGameDaysInfiniteQuery();
  const auction = useGetAuctionGameDaysInfiniteQuery();
  const { data: carStats, refetch: refetchCarStats } = useGetCarGameStatsQuery();
  const { data: auctionStats, refetch: refetchAuctionStats } = useGetAuctionGameStatsQuery();
  const carDays = useDays<CarDay>(car.data?.pages);
  const auctionDays = useDays<AuctionDay>(auction.data?.pages);
  const q = isCar ? car : auction;
  const today = q.data?.pages?.[0]?.today;

  const rows = useMemo<Row[]>(() => (isCar
    ? carDays.map((day) => ({ kind: 'car' as const, day }))
    : auctionDays.map((day) => ({ kind: 'auction' as const, day }))), [isCar, carDays, auctionDays]);

  const refreshControl = useRefreshControl(
    () => Promise.all(isCar ? [car.refetch(), refetchCarStats()] : [auction.refetch(), refetchAuctionStats()]),
    headerPad,
  );

  // Today's is the game itself; any other day is that day's.
  const open = (date: string) => navigation.navigate('DailyGame', date === today ? { game } : { game, date });

  const header = (
    <View style={styles.header}>
      <GamePicker value={game} onChange={setGame} />
      {isCar
        ? (carStats ? <CarStatsSummary stats={carStats} /> : null)
        : (auctionStats ? <AuctionStatsSummary stats={auctionStats} /> : null)}
    </View>
  );

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => `${r.kind}:${r.day.play_date}`}
      renderItem={({ item }) => (item.kind === 'car'
        ? <CarDayRow day={item.day} isToday={item.day.play_date === today} onPress={() => open(item.day.play_date)} />
        : <AuctionDayRow day={item.day} isToday={item.day.play_date === today} onPress={() => open(item.day.play_date)} />)}
      ListHeaderComponent={header}
      ListEmptyComponent={q.isLoading ? <Spinner />
        : q.isError ? <EmptyState title="Couldn't load past games" actionLabel="Try again" onAction={q.refetch} />
        : <EmptyState title="Nothing yet" />}
      ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator style={styles.more} color={COLOR_WHITE} /> : null}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      contentContainerStyle={[styles.content, { paddingTop: headerPad + 12, paddingBottom: bottomPad }]}
      onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); }}
      onEndReachedThreshold={0.5}
      refreshControl={refreshControl}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER + 8 },
  header: { gap: 12, marginBottom: 14 },
  sep: { height: 8 },
  more: { marginVertical: 16 },
});
