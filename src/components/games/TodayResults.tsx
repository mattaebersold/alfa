import React, { useCallback, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Text } from '../../theme/Text';
import Avatar from '../ui/Avatar';
import SubTabs from '../ui/SubTabs';
import { CarResult, AuctionResult } from '../feed/SpotDaySummaryModal';
import { useGetSpotFeedTodayQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { shortTimeAgo } from '../../utils/shortTimeAgo';
import { DAILY_GAMES } from './game';
import { COMMON_RADIUS, COLOR_GRAY_160, COLOR_WHITE, SURFACE_MID } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import type { DailyGameKind } from '../../types/games';

const TABS = DAILY_GAMES.map((g) => ({ key: g.value, label: g.value === 'auction' ? 'Guess the Auction' : g.label }));

/**
 * Today's results, one game at a time (a tab each): yours first, marked
 * "You" — the server sends it apart from the others (`me`), so on a day
 * you're the only one who's played the list used to say no one had — then
 * the other Pro players', the latest first — what the home feed's Played Today row shows, as
 * a list. Spoiler-free, as the server sends it: the car's guess grid, the
 * auction's score and how far off. A tap opens the player's profile.
 */
export default function TodayResults() {
  const navigation = useNavigation<any>();
  const [game, setGame] = useState<DailyGameKind>('car');
  const { data, isLoading, refetch } = useGetSpotFeedTodayQuery();
  // It fills up through the day.
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const rows = (data?.players ?? []).filter((p) => (game === 'car' ? p.car : p.auction));
  const userInfo = useAppSelector((s) => s.auth.userInfo);
  const mine = data?.me && (game === 'car' ? data.me.car : data.me.auction) ? data.me : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Today’s Results</Text>
      <SubTabs<DailyGameKind> options={TABS} value={game} onChange={setGame} inset={0} stretch />
      {mine && userInfo ? (
        <View style={styles.row}>
          <Avatar user={userInfo as any} size={34} />
          <View style={styles.who}>
            <Text style={styles.name} numberOfLines={1}>You</Text>
          </View>
          <View style={[styles.result, game === 'auction' && styles.resultAuction]}>
            {game === 'car' && mine.car ? <CarResult car={mine.car} /> : null}
            {game === 'auction' && mine.auction ? <AuctionResult auction={mine.auction} /> : null}
          </View>
        </View>
      ) : null}
      {rows.map((p) => (
        <TouchableOpacity
          key={p.user.user_id}
          style={styles.row}
          onPress={() => navigation.navigate('UserDetail', { userId: p.user.user_id, username: p.user.username })}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Avatar user={p.user} size={34} />
          <View style={styles.who}>
            <Text style={styles.name} numberOfLines={1}>{p.user.username}</Text>
            {p.played_at ? <Text style={styles.when}>{shortTimeAgo(p.played_at)}</Text> : null}
          </View>
          <View style={[styles.result, game === 'auction' && styles.resultAuction]}>
            {game === 'car' && p.car ? <CarResult car={p.car} /> : null}
            {game === 'auction' && p.auction ? <AuctionResult auction={p.auction} /> : null}
          </View>
        </TouchableOpacity>
      ))}
      {!isLoading && !rows.length && !mine ? (
        <Text style={styles.empty}>
          {`No one’s ${game === 'car' ? 'guessed the car' : 'guessed the auction'} yet today.`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  heading: { color: COLOR_WHITE, fontSize: 17, fontFamily: FONT_INTER.bold },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: SURFACE_MID, borderRadius: COMMON_RADIUS, paddingHorizontal: 12, paddingVertical: 10,
  },
  who: { flex: 1, minWidth: 0, gap: 1 },
  name: { color: COLOR_WHITE, fontSize: 14, fontFamily: FONT_INTER.bold },
  when: { color: COLOR_GRAY_160, fontSize: 12 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  // The score bar flexes — give it room to.
  resultAuction: { width: 150 },
  empty: { color: COLOR_GRAY_160, fontSize: 13, paddingTop: 4 },
});
