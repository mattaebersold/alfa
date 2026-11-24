import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from '../../../theme/Text';
import { DAILY_GAMES } from '../../games/game';
import { FONT_INTER } from '../../../constants/fonts';
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
  AuctionLeaderboardEntry, CarLeaderboardEntry, DailyGameKind, GameUserLite, LeaderboardPeriod,
} from '../../../types/games';
import type { SectionScreenProps } from '../types';

type Sort = 'best' | 'fastest';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'best', label: 'Most solved' },
  { key: 'fastest', label: 'Fastest' },
];

/**
 * The windows a board can cover. All time first and the default: it never
 * starts over, so a good run keeps counting. Week / month / year are calendar
 * windows (week from Monday) — the server keeps every game; a window only
 * decides which count.
 */
const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: 'year', label: 'Year' },
  { key: 'month', label: 'Month' },
  { key: 'week', label: 'Week' },
];
/** How a window reads in a sentence: "this week", "all time". */
const SPAN: Record<LeaderboardPeriod, string> = { week: 'this week', month: 'this month', year: 'this year', all: 'of all time' };

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

/** What a board ranks by, in words — said for the window it covers. */
const metricFor = (key: Sort | 'auction', period: LeaderboardPeriod): BoardMetric => {
  const span = SPAN[period];
  if (key === 'best') return { name: 'Cars solved', how: `Most cars solved ${span}. Ties go to the better win rate, then fewer hints, then the quicker average time.` };
  if (key === 'fastest') return { name: 'Fastest win', how: `Each player’s quickest solve ${span}.`, lowerIsBetter: true };
  return { name: 'Average score', how: `Each guess scores up to 100 for how close it came to the sale price — averaged ${period === 'all' ? 'over every game' : span}.`, max: 100 };
};

/** "Nobody has finished a car this week." — for the window. */
const emptyFor = (game: DailyGameKind, sort: Sort, period: LeaderboardPeriod) => (game === 'car'
  ? (sort === 'fastest'
    ? { title: 'No times yet', message: 'Solve today’s car to set one.' }
    : { title: 'No one yet', message: `Nobody has finished a car ${period === 'all' ? 'yet' : SPAN[period]}.` })
  : { title: 'No one yet', message: `Nobody has guessed an auction ${period === 'all' ? 'yet' : SPAN[period]}.` });

/** One game's board for a sort and a window — the screen's and the Games tab's. */
function useBoard(game: DailyGameKind, sort: Sort, period: LeaderboardPeriod) {
  const car = useGetCarGameLeaderboardQuery({ sort, period }, { skip: game !== 'car' });
  const auction = useGetAuctionGameLeaderboardQuery(period, { skip: game !== 'auction' });
  const q = game === 'car' ? car : auction;
  const rows = game === 'car' ? carRows(car.data?.entries ?? [], sort) : auctionRows(auction.data?.entries ?? []);
  return { q, rows, metric: metricFor(game === 'car' ? sort : 'auction', period), empty: emptyFor(game, sort, period) };
}

/**
 * PRO › Leaderboards: each game's board over a window — all time (the
 * default; it never starts over), this year, month or week — Pro members only — the server leaves everyone else off. The top
 * three on a podium, then everyone else as bars on one scale. Ported from
 * Car Spotter's Leaderboard and RankedBoard.
 */
export default function LeaderboardsScreen({ headerPad, onScroll, bottomPad, game: fixed }: SectionScreenProps & {
  /** Just this game's board, with no switch — from the game's own screen (GameListScreen). */
  game?: DailyGameKind;
}) {
  const navigation = useNavigation<any>();
  const me = useAppSelector((s) => s.auth.userInfo?.user_id);
  const [picked, setGame] = useState<DailyGameKind>('car');
  const game = fixed ?? picked;
  const [sort, setSort] = useState<Sort>('best');
  const [period, setPeriod] = useState<LeaderboardPeriod>('all');
  const { q, rows, metric, empty } = useBoard(game, sort, period);
  const openUser = useCallback(
    (user: GameUserLite) => navigation.navigate('UserDetail', { userId: user.user_id, username: user.username }),
    [navigation],
  );

  const switches = (
    <View style={styles.switches}>
      {fixed ? null : <GamePicker value={game} onChange={setGame} />}
      <SubTabs options={PERIODS} value={period} onChange={setPeriod} inset={0} tone="grey" stretch />
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
      rows={rows}
      metric={metric}
      me={me}
      onOpen={openUser}
      // All time never starts over — no reset line.
      resetsAt={q.data?.resets_at ?? undefined}
      top={headerPad + 8}
      bottom={bottomPad}
      above={switches}
      onScroll={onScroll}
      stale={q.isFetching}
      refreshing={q.isFetching && !q.isLoading}
      onRefresh={q.refetch}
      empty={empty}
    />
  );
}

/** How many rows the Games tab's short board shows — the podium and the next seven. */
const SHORT_BOARD = 10;
const GAME_TABS = DAILY_GAMES.map((g) => ({ key: g.value, label: g.value === 'auction' ? 'Guess the Auction' : g.label }));

/**
 * A leaderboard on the Games tab, under Today's Results: a game at a time
 * (tabs, as the results above), the window (all time by default), and for the
 * car most solved or fastest — the top ten, drawn in the page rather than as a
 * list of its own. The full board is PRO › Leaderboards.
 */
export function GamesLeaderboard() {
  const navigation = useNavigation<any>();
  const me = useAppSelector((s) => s.auth.userInfo?.user_id);
  const [game, setGame] = useState<DailyGameKind>('car');
  const [sort, setSort] = useState<Sort>('best');
  const [period, setPeriod] = useState<LeaderboardPeriod>('all');
  const { q, rows, metric, empty } = useBoard(game, sort, period);
  const openUser = useCallback(
    (user: GameUserLite) => navigation.navigate('UserDetail', { userId: user.user_id, username: user.username }),
    [navigation],
  );

  return (
    <View style={styles.short}>
      <Text style={styles.heading}>Leaderboard</Text>
      <SubTabs<DailyGameKind> options={GAME_TABS} value={game} onChange={setGame} inset={0} stretch />
      <SubTabs options={PERIODS} value={period} onChange={setPeriod} inset={0} tone="grey" stretch />
      {game === 'car' ? <SubTabs options={SORTS} value={sort} onChange={setSort} inset={0} tone="grey" /> : null}
      {q.isLoading ? (
        <ActivityIndicator style={styles.loading} color={COLOR_WHITE} />
      ) : q.isError ? (
        <EmptyState title="Couldn't load the leaderboard" actionLabel="Try again" onAction={q.refetch} />
      ) : (
        <RankedBoard
          inline
          limit={SHORT_BOARD}
          rows={rows}
          metric={metric}
          me={me}
          onOpen={openUser}
          resetsAt={q.data?.resets_at ?? undefined}
          bottom={0}
          stale={q.isFetching}
          empty={empty}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  padded: { paddingHorizontal: 14 },
  switches: { gap: 10 },
  loading: { marginTop: 40 },
  short: { gap: 10 },
  heading: { color: COLOR_WHITE, fontSize: 17, fontFamily: FONT_INTER.bold },
});
