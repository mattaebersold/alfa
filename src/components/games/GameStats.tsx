import React, { useState } from 'react';
import { View, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import { ChevronDown, Flame } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import { useBrandColor, useBrandTextColor } from '../../hooks/useBrandColor';
import { colors } from '../../constants/colors';
import { COMMON_RADIUS, COLOR_GRAY_160, COLOR_WHITE } from '../../constants/config';
import { MAX_ATTEMPTS, type AuctionStats, type CarStats } from '../../types/games';
import { GAME_CARD } from './game';

/**
 * A game's record, under a finished game: the car's played, win %, streaks
 * and guess distribution; the auction's played, average and best score, and
 * bullseyes. Ported from Car Spotter's StatsSummary and GameStatsSummary.
 */

/** One number on its own tile. */
function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.statValue}>{value}</Text>
      {/* One line, whatever the tile's width: shrinks a touch rather than wrap. */}
      <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{label}</Text>
    </View>
  );
}

const ROWS = [...Array.from({ length: MAX_ATTEMPTS }, (_, i) => String(i + 1)), 'X'];

/**
 * The car's. `highlight` is the row today's game landed in ('1'–'5', or 'X'
 * for a loss), in the brand colour; the distribution opens with it, folded
 * away otherwise.
 */
export function CarStatsSummary({ stats, highlight }: { stats: CarStats; highlight?: string | null }) {
  const brand = useBrandColor();
  const brandText = useBrandTextColor();
  const dist = stats.distribution ?? {};
  const losses = Math.max(0, (stats.played ?? 0) - (stats.won ?? 0));
  const counts = ROWS.map((k) => (k === 'X' ? losses : Number(dist[k]) || 0));
  const most = Math.max(1, ...counts);
  const [open, setOpen] = useState(!!highlight);
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.tiles}>
        <Stat value={stats.played ?? 0} label="Played" />
        <Stat value={Math.round(stats.win_rate ?? 0)} label="Win %" />
        <Stat value={stats.current_streak ?? 0} label="Current streak" />
        <Stat value={stats.max_streak ?? 0} label="Max streak" />
      </View>
      <View style={styles.card}>
        <Pressable onPress={toggle} style={styles.headingRow} hitSlop={8} accessibilityRole="button" accessibilityState={{ expanded: open }}>
          <Text style={styles.heading}>Guess distribution</Text>
          <ChevronDown size={16} color={COLOR_GRAY_160} strokeWidth={2.6} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
        </Pressable>
        {open && (
          <View style={styles.bars}>
            {ROWS.map((k, i) => {
              const on = highlight === k;
              const n = counts[i];
              return (
                <View key={k} style={styles.barRow}>
                  <Text style={styles.barKey}>{k}</Text>
                  <View style={styles.barTrack}>
                    {/* A floor width so a zero still shows its count. */}
                    <View style={[styles.bar, { width: `${Math.max(8, (n / most) * 100)}%`, backgroundColor: on ? brand : '#3C3C3C' }]}>
                      <Text style={[styles.barCount, { color: on ? brandText : COLOR_WHITE }]}>{n}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

/** The auction's: played, average and best score, and bullseyes (within 5% of the price). */
export function AuctionStatsSummary({ stats }: { stats: AuctionStats }) {
  return (
    <View style={styles.tiles}>
      <Stat value={stats.played ?? 0} label="Played" />
      <Stat value={Math.round(stats.average_score ?? 0)} label="Avg score" />
      <Stat value={stats.best_score ?? 0} label="Best score" />
      <Stat value={stats.bullseyes ?? 0} label="Bullseyes" />
    </View>
  );
}

/**
 * The current streak: a flame in the Pro red on black — the same red for
 * everyone, so a streak always reads as heat.
 */
export function StreakBadge({ streak, small = false }: { streak: number; small?: boolean }) {
  return (
    <View style={[styles.streak, small && styles.streakSmall]} accessibilityLabel={`Current streak ${streak}`}>
      <Flame size={small ? 13 : 16} color={colors.pro} fill={colors.pro} strokeWidth={2} />
      <Text style={[styles.streakText, small && styles.streakTextSmall]}>{streak}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: GAME_CARD, borderRadius: COMMON_RADIUS, paddingVertical: 14, paddingHorizontal: 4,
  },
  card: { backgroundColor: GAME_CARD, borderRadius: COMMON_RADIUS, paddingHorizontal: 16, paddingBottom: 16 },
  statValue: { color: COLOR_WHITE, fontSize: 20, fontWeight: '800' },
  statLabel: { color: COLOR_GRAY_160, fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 2, maxWidth: '100%' },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16 },
  heading: { color: COLOR_WHITE, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  bars: { gap: 5, marginTop: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barKey: { width: 12, color: COLOR_GRAY_160, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  barTrack: { flex: 1 },
  bar: { minHeight: 20, borderRadius: 4, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 6 },
  barCount: { fontSize: 12, fontWeight: '800' },
  streak: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 34, borderRadius: 17, paddingHorizontal: 12,
    backgroundColor: '#000000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  streakSmall: { height: 24, borderRadius: 12, paddingHorizontal: 8, gap: 4 },
  streakText: { color: COLOR_WHITE, fontSize: 15 },
  streakTextSmall: { fontSize: 12, fontWeight: '700' },
});
