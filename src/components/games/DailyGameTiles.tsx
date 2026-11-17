import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../../theme/Text';
import { Image } from '../ui/AppImage';
import { DAILY_GAMES, dayLabel } from './game';
import { useGetCarGameTodayQuery, useGetAuctionGameTodayQuery } from '../../api/apiService';
import { colors as palette } from '../../constants/colors';
import { COMMON_RADIUS, COLOR_BLACK, COLOR_WHITE, PILL_RADIUS, SURFACE_MID } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/** Each tile's picture, in DAILY_GAMES' order — both blurred, so neither gives its answer away. */
const TILES = [
  { label: 'Guess the Car', image: require('../../../assets/games/guess-the-car.jpg'), blur: 14 },
  { label: 'Guess the Auction', image: require('../../../assets/games/guess-the-auction.jpg'), blur: 14 },
];

/** "Tue, Nov 17" — the day these games are for, or today's date before they've loaded. */
const todayPill = (date?: string) => (date
  ? dayLabel(date, 'EEE, MMM d')
  : new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));

/**
 * Today's two Daily Games as tiles, twice as wide as tall, side by side —
 * PRO › Home's lead and PRO › Games. Over them, `title` (if any) and the
 * day's date as a pill; on a tile, "New" until you've played it. Each opens
 * that game's screen (DailyGameScreen), where its Past Games and Leaderboard
 * are.
 */
export default function DailyGameTiles({ title }: { title?: string }) {
  const navigation = useNavigation<any>();
  // The games' own today — shared with their screens and the status hooks.
  const car = useGetCarGameTodayQuery().data;
  const auction = useGetAuctionGameTodayQuery().data;
  const today = [car, auction];
  const date = car?.puzzle?.play_date ?? auction?.puzzle?.play_date;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
        <View style={styles.datePill}>
          <Text style={styles.dateText}>{todayPill(date)}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {TILES.map((t, i) => {
          // Today's game, and you've not made a move in it yet.
          const isNew = !!today[i]?.puzzle && !today[i]?.play;
          return (
            <TouchableOpacity
              key={t.label}
              style={styles.tile}
              onPress={() => navigation.navigate('DailyGame', { game: DAILY_GAMES[i].value })}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isNew ? `${t.label}, new` : t.label}
            >
              <Image source={t.image} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={t.blur} />
              {/* Clear at the top, darkening down to the title. */}
              <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
              {isNew ? (
                <View style={styles.newBadge}>
                  <Text style={styles.newText}>NEW</Text>
                </View>
              ) : null}
              <Text style={styles.label} numberOfLines={2}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  // The home shelves' heading (PostStrip's title), so Daily Games reads as one of them.
  title: { flexShrink: 1, color: COLOR_WHITE, fontSize: 17, fontFamily: FONT_INTER.semibold },
  // The home feed's Played Today date pill.
  datePill: {
    height: 26, paddingHorizontal: 10, borderRadius: PILL_RADIUS, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  dateText: { color: COLOR_WHITE, fontSize: 12.5, lineHeight: 16, fontFamily: FONT_INTER.bold },
  grid: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1, aspectRatio: 2, borderRadius: COMMON_RADIUS, overflow: 'hidden',
    backgroundColor: SURFACE_MID, justifyContent: 'flex-end',
  },
  // Top left, in the Pro red.
  newBadge: {
    position: 'absolute', top: 8, left: 8,
    paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: PILL_RADIUS, backgroundColor: palette.pro,
  },
  newText: { color: COLOR_BLACK, fontSize: 10, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.6 },
  label: { color: COLOR_WHITE, fontSize: 15, fontFamily: FONT_INTER.bold, paddingHorizontal: 10, paddingBottom: 9 },
});
