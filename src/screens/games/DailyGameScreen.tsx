import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarX, History, Trophy } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import CarGame from '../../components/games/CarGame';
import AuctionGame from '../../components/games/AuctionGame';
import Countdown from '../../components/games/Countdown';
import { CarStatsSummary, AuctionStatsSummary } from '../../components/games/GameStats';
import { useDayTurnover } from '../../components/games/useDayTurnover';
import {
  GAME_BG, GAME_CARD, GAME_GUTTER, dayLabel, gameLabel, isNoGame, nextLabel,
} from '../../components/games/game';
import {
  apiService,
  useGetCarGameTodayQuery, useGetCarGameDayQuery, useGetCarGameStatsQuery,
  useGetAuctionGameTodayQuery, useGetAuctionGameDayQuery, useGetAuctionGameStatsQuery,
} from '../../api/apiService';
import { useAppDispatch } from '../../store/store';
import { COMMON_RADIUS, COLOR_GRAY_160, COLOR_WHITE } from '../../constants/config';
import type { DailyGameKind, CarPlay } from '../../types/games';
import type { FeedStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<FeedStackParamList, 'DailyGame'>;

/** Over today's game: this game's Past Games and Leaderboard (GameListScreen). */
function GameLinks({ game }: { game: DailyGameKind }) {
  const navigation = useNavigation<any>();
  const links = [
    { list: 'past' as const, label: 'Past Games', Icon: History },
    { list: 'boards' as const, label: 'Leaderboard', Icon: Trophy },
  ];
  return (
    <View style={styles.links}>
      {links.map(({ list, label, Icon }) => (
        <TouchableOpacity
          key={list}
          style={styles.link}
          onPress={() => navigation.navigate('GameList', { game, list })}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Icon size={15} color={COLOR_WHITE} strokeWidth={2.2} />
          <Text style={styles.linkText}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Nothing scheduled for today: says so, and when to look again. */
function NoGame({ game, nextAt, onRetry }: { game: DailyGameKind; nextAt?: string; onRetry: () => void }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View style={[styles.noGame, { paddingBottom: bottom + 24 }]}>
      <CalendarX size={36} color={COLOR_GRAY_160} strokeWidth={1.8} />
      <Text style={styles.noGameTitle}>No game today</Text>
      <Text style={styles.noGameText}>
        {`There's no ${game === 'car' ? 'car' : 'auction'} lined up for today. Past Games are still there to catch up on.`}
      </Text>
      {nextAt ? <Countdown nextAt={nextAt} label={nextLabel(game)} /> : null}
      <View style={styles.noGameLinks}><GameLinks game={game} /></View>
      <Button label="Refresh" variant="secondary" size="sm" onPress={onRetry} />
    </View>
  );
}

function Failed({ onRetry }: { onRetry: () => void }) {
  return <EmptyState title="Couldn't load the game" actionLabel="Try again" onAction={onRetry} />;
}

/** The note over a day played after it was over. */
function LateNote({ date }: { date: string }) {
  return (
    <View style={styles.note}>
      <Text style={styles.noteText}>
        {`Catching up on ${dayLabel(date)}. Play it in full — it just won't count toward your stats or streak.`}
      </Text>
    </View>
  );
}

/** Which row of the distribution a finished car game lands in — lit under the result. */
const carRow = (play: CarPlay | null) => (!play || play.status === 'playing' ? null
  : play.status === 'won' ? String(play.attempts) : 'X');

/**
 * A new day moves the log along a row and can end a streak: both refetch
 * once a fresh day's puzzle arrives on a screen that already had one.
 */
function useNewDay(game: DailyGameKind, day: string | undefined) {
  const dispatch = useAppDispatch();
  const last = useRef(day);
  useEffect(() => {
    if (!day || day === last.current) return;
    const first = last.current === undefined;
    last.current = day;
    if (!first) {
      const type = game === 'car' ? 'CarGame' as const : 'AuctionGame' as const;
      dispatch(apiService.util.invalidateTags([{ type, id: 'DAYS' }, { type, id: 'STATS' }]));
    }
  }, [day, dispatch, game]);
}

function CarToday() {
  const { currentData: data, isLoading, isError, error, refetch, isFetching, fulfilledTimeStamp } = useGetCarGameTodayQuery();
  const { data: stats } = useGetCarGameStatsQuery();
  useDayTurnover(data?.next_at, fulfilledTimeStamp, refetch);
  useNewDay('car', data?.puzzle?.play_date);

  if (isLoading || (!data && isFetching && !isError)) return <Spinner fullScreen />;
  if (isNoGame(error) || (data && !data.puzzle)) return <NoGame game="car" nextAt={data?.next_at} onRetry={refetch} />;
  if (isError || !data?.puzzle) return <Failed onRetry={refetch} />;
  const { puzzle, play, next_at } = data;
  return (
    <CarGame
      // A new day's puzzle starts fresh.
      key={puzzle.play_date}
      puzzle={puzzle}
      play={play}
      credit={data.credit}
      onStale={refetch}
      timed
      refreshing={isFetching && !isLoading}
      onRefresh={refetch}
      above={<GameLinks game="car" />}
      doneFooter={<Countdown nextAt={next_at} label={nextLabel('car')} />}
    >
      {stats ? <CarStatsSummary stats={stats} highlight={carRow(play)} /> : null}
    </CarGame>
  );
}

function CarPastDay({ date }: { date: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useGetCarGameDayQuery(date);
  if (isLoading) return <Spinner fullScreen />;
  if (isError || !data) return <Failed onRetry={refetch} />;
  const { puzzle, play } = data;
  const isToday = date === data.today;
  // Today's opened from the log counts like any other game of it.
  const late = play ? !!play.late : !isToday;
  return (
    <CarGame
      key={puzzle.play_date}
      puzzle={puzzle}
      play={play}
      credit={data.credit}
      onStale={refetch}
      timed={isToday}
      refreshing={isFetching && !isLoading}
      onRefresh={refetch}
      above={late ? <LateNote date={date} /> : null}
    />
  );
}

function AuctionToday() {
  const { currentData: data, isLoading, isError, error, refetch, isFetching, fulfilledTimeStamp } = useGetAuctionGameTodayQuery();
  const { data: stats } = useGetAuctionGameStatsQuery();
  useDayTurnover(data?.next_at, fulfilledTimeStamp, refetch);
  useNewDay('auction', data?.puzzle?.play_date);

  if (isLoading || (!data && isFetching && !isError)) return <Spinner fullScreen />;
  if (isNoGame(error) || (data && !data.puzzle)) return <NoGame game="auction" nextAt={data?.next_at} onRetry={refetch} />;
  if (isError || !data?.puzzle) return <Failed onRetry={refetch} />;
  const { puzzle, play, next_at } = data;
  return (
    <AuctionGame
      key={puzzle.play_date}
      puzzle={puzzle}
      play={play}
      onStale={refetch}
      timed
      refreshing={isFetching && !isLoading}
      onRefresh={refetch}
      above={<GameLinks game="auction" />}
      doneFooter={<Countdown nextAt={next_at} label={nextLabel('auction')} />}
    >
      {stats ? <AuctionStatsSummary stats={stats} /> : null}
    </AuctionGame>
  );
}

function AuctionPastDay({ date }: { date: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useGetAuctionGameDayQuery(date);
  if (isLoading) return <Spinner fullScreen />;
  if (isError || !data) return <Failed onRetry={refetch} />;
  const { puzzle, play } = data;
  const isToday = date === data.today;
  const late = play ? play.late : !isToday;
  return (
    <AuctionGame
      key={date}
      puzzle={puzzle}
      play={play}
      onStale={refetch}
      timed={isToday}
      refreshing={isFetching && !isLoading}
      onRefresh={refetch}
      above={late ? <LateNote date={date} /> : null}
    />
  );
}

/**
 * One of the PRO tab's Daily Games, full screen: today's (no `date`), or a
 * past day's from Past Games — to play late, or to look back on. Played the
 * same either way; one begun after its day is `late`, and the server keeps
 * it out of the stats, the streak and the board.
 */
export default function DailyGameScreen({ route, navigation }: Props) {
  const { game, date } = route.params;

  useEffect(() => {
    navigation.setOptions({ title: date ? `${gameLabel(game)} · ${dayLabel(date, 'MMM d')}` : gameLabel(game) });
  }, [navigation, date, game]);

  return (
    <View style={styles.screen}>
      {game === 'car'
        ? (date ? <CarPastDay date={date} /> : <CarToday />)
        : (date ? <AuctionPastDay date={date} /> : <AuctionToday />)}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: GAME_BG },
  note: { backgroundColor: GAME_CARD, borderRadius: COMMON_RADIUS, paddingHorizontal: 14, paddingVertical: 10, marginTop: 8 },
  noteText: { color: COLOR_GRAY_160, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  noGame: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: GAME_GUTTER + 24 },
  noGameTitle: { color: COLOR_WHITE, fontSize: 20, fontWeight: '800' },
  links: { flexDirection: 'row', gap: 8, marginTop: 8 },
  link: {
    flex: 1, height: 36, borderRadius: 18, flexDirection: 'row', gap: 6,
    alignItems: 'center', justifyContent: 'center', backgroundColor: GAME_CARD,
  },
  linkText: { color: COLOR_WHITE, fontSize: 13.5, fontWeight: '700' },
  noGameLinks: { alignSelf: 'stretch' },
  noGameText: { color: COLOR_GRAY_160, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
