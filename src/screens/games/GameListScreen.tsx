import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import PastGamesScreen from '../../components/sections/pro/PastGamesScreen';
import LeaderboardsScreen from '../../components/sections/pro/LeaderboardsScreen';
import { GAME_BG, gameLabel } from '../../components/games/game';
import type { FeedStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<FeedStackParamList, 'GameList'>;

const noop = () => {};

/**
 * One game's Past Games or Leaderboard, on a screen of its own — what the
 * links on that game's screen (DailyGameScreen) open. The PRO › Games
 * panes, fixed to the one game and without their game switch.
 */
export default function GameListScreen({ route, navigation }: Props) {
  const { game, list } = route.params;
  const { bottom } = useSafeAreaInsets();

  useEffect(() => {
    navigation.setOptions({ title: `${gameLabel(game)} · ${list === 'past' ? 'Past Games' : 'Leaderboard'}` });
  }, [navigation, game, list]);

  const props = { headerPad: 0, bottomPad: bottom + 24, onScroll: noop, active: true, game };
  return (
    <View style={styles.screen}>
      {list === 'past' ? <PastGamesScreen {...props} /> : <LeaderboardsScreen {...props} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: GAME_BG },
});
