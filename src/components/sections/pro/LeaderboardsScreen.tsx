import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import EmptyState from '../../ui/EmptyState';
import SubTabs from '../../ui/SubTabs';
import RankedBoard, { type BoardMetric, type RankedRow } from '../../games/RankedBoard';
import GamePicker from './GamePicker';
import { formatElapsed } from '../../games/game';
import { useGetCarGameLeaderboardQuery, useGetAuctionGameLeaderboardQuery } from '../../../api/apiService';
import { useAppSelector } from '../../../store/store';
import { COLOR_WHITE } from '../../../constants/config';
import type {
  AuctionLeaderboardEntry, CarLeaderboardEntry, DailyGameKind, GameUserLite,
} from '../../../types/games';
import type { SectionScreenProps } from '../types';

type Sort = 'best' | 'fastest';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'best', label: 'Most solved' },
  { key: 'fastest', label: 'Fastest' },
];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : word.endsWith('s') ? 'es' : 's'}`;

/** The car's rows, by most solved or by fastest win. */
const carRows = (entries: CarLeaderboardEntry[], sort: Sort): RankedRow[] => entries.map((e) => (sort === 'fastest'
  ? {
    user: e.user,
    value: e.best_ms ?? 0,
    valueLabel: e.best_ms != null ? formatElapsed(e.best_ms) : '—',
    short: plural(e.won, 'win'),
    detail: `${plural(e.won, 'car')} solved${e.avg_ms != null ? ` · ${formatElapsed(e.avg_ms)} on average` : ''}`,
  }
  : {
    user: e.user,
    value: e.won,
    valueLabel: `${e.won}/${e.played}`,
    short: `${Math.round(e.win_rate)}%${e.avg_ms != null ? ` · ${formatElapsed(e.avg_ms)}` : ''}`,
    podium: e.won > 0,
    detail: `${e.won} of ${plural(e.played, 'car')} solved`
      + `${e.avg_ms != null ? ` · avg ${formatElapsed(e.avg_ms)}` : ''}`
      + `${e.hints ? ` · ${plural(e.hints, 'hint')}` : ''}`,
  }));

const auctionRows = (entries: AuctionLeaderboardEntry[]): RankedRow[] => entries.map((e) => ({
  user: e.user,
  value: e.average_score ?? 0,
  valueLabel: `${Math.round(e.average_score ?? 0)}`,
  short: plural(e.played, 'guess'),
  detail: `Best ${e.best_score ?? 0} · ${plural(e.played, 'auction')} played`,
}));

const METRICS: Record<Sort | 'auction', BoardMetric> = {
  best: { name: 'Cars solved', how: 'Most cars solved this week. Ties go to the better win rate, then fewer hints, then the quicker average time.' },
  fastest: { name: 'Fastest win', how: 'Each player’s quickest solve this week.', lowerIsBetter: true },
  auction: { name: 'Average score', how: 'Each guess scores up to 100 for how close it came to the sale price.', max: 100 },
};

/**
 * PRO › Leaderboards: this week's board for each game (they start over each
 * Monday), Pro members only — the server leaves everyone else off. The top
 * three on a podium, then everyone else as bars on one scale. Ported from
 * Car Spotter's Leaderboard and RankedBoard.
 */
export default function LeaderboardsScreen({ headerPad, onScroll, bottomPad }: SectionScreenProps) {
  const navigation = useNavigation<any>();
  const me = useAppSelector((s) => s.auth.userInfo?.user_id);
  const [game, setGame] = useState<DailyGameKind>('car');
  const [sort, setSort] = useState<Sort>('best');
  const car = useGetCarGameLeaderboardQuery(sort, { skip: game !== 'car' });
  const auction = useGetAuctionGameLeaderboardQuery(undefined, { skip: game !== 'auction' });
  const q = game === 'car' ? car : auction;
  const openUser = useCallback(
    (user: GameUserLite) => navigation.navigate('UserDetail', { userId: user.user_id, username: user.username }),
    [navigation],
  );

  const switches = (
    <View style={styles.switches}>
      <GamePicker value={game} onChange={setGame} />
      {game === 'car' ? <SubTabs options={SORTS} value={sort} onChange={setSort} inset={0} tone="grey" /> : null}
    </View>
  );

  if (q.isLoading || q.isError) {
    return (
      <View style={[styles.fill, { paddingTop: headerPad + 12 }]}>
        <View style={styles.padded}>{switches}</View>
        {q.isLoading
          ? <ActivityIndicator style={styles.loading} color={COLOR_WHITE} />
          : <EmptyState title="Couldn't load the leaderboard" actionLabel="Try again" onAction={q.refetch} />}
      </View>
    );
  }

  return (
    <RankedBoard
      rows={game === 'car' ? carRows(car.data?.entries ?? [], sort) : auctionRows(auction.data?.entries ?? [])}
      metric={game === 'car' ? METRICS[sort] : METRICS.auction}
      me={me}
      onOpen={openUser}
      resetsAt={q.data?.resets_at}
      top={headerPad + 8}
      bottom={bottomPad}
      above={switches}
      onScroll={onScroll}
      stale={q.isFetching}
      refreshing={q.isFetching && !q.isLoading}
      onRefresh={q.refetch}
      empty={game === 'car'
        ? (sort === 'fastest' ? { title: 'No times yet', message: 'Solve today’s car to set one.' } : { title: 'No one yet', message: 'Nobody has finished a car this week.' })
        : { title: 'No one yet', message: 'Nobody has guessed an auction this week.' }}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  padded: { paddingHorizontal: 14 },
  switches: { gap: 10 },
  loading: { marginTop: 40 },
});
