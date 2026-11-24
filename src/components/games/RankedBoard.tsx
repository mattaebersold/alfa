import React, { useEffect, useMemo, useState } from 'react';
import { View, FlatList, Pressable, StyleSheet, RefreshControl, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import Avatar from '../ui/Avatar';
import EmptyState from '../ui/EmptyState';
import { SimpleCrown } from '../feed/SpotResultBody';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useAppSelector } from '../../store/store';
import { COMMON_RADIUS } from '../../constants/config';
import type { GameUserLite as SpotUserLite } from '../../types/games';
import { GAME_CARD, GAME_GUTTER as GUTTER } from './game';

/** Members I've blocked, left off the boards. */
function useBlockedIds(): Set<string> {
  const ids = useAppSelector((s) => s.moderation.blockedUserIds);
  return useMemo(() => new Set(ids), [ids]);
}

/** One player on a board, already ranked: what they're ranked by, and the line under it. */
export interface RankedRow {
  user: SpotUserLite;
  /** The number they're ranked by — a bar's length. */
  value: number;
  /** That number as it reads: "86%", "0:42", "74". */
  valueLabel: string;
  /** Their record behind it: "18 of 21 right · 12 played". */
  detail: string;
  /** A few words of it for the podium step: "3/3 · 0:41". */
  short?: string;
  /** False keeps them off the podium — nothing right yet — however they rank. */
  podium?: boolean;
}

/** What a board ranks by, so the screen can say so in words. */
export interface BoardMetric {
  /** "Win rate", "Fastest win", "Average score". */
  name: string;
  /** One line under it: how it's worked out. */
  how: string;
  /** The top of the bars' scale — 100 for a percentage or a score; the longest shown when unset. */
  max?: number;
  /** Lower ranks higher (a time): bars still grow with the number, and the caption says shorter is better. */
  lowerIsBetter?: boolean;
}

/**
 * Medal colours for the podium. Decoration with a number on every step, so
 * nobody has to tell gold from bronze by colour alone.
 */
const MEDALS = ['#E8B931', '#B8BEC6', '#C27C4A'];
/** Step heights, first to third. */
const STEP_H = [126, 106, 92];

/** One step of the podium: the player on top, their number on the step. */
function Step({ row, place, me, onOpen }: { row: RankedRow; place: number; me: boolean; onOpen: (user: SpotUserLite) => void }) {
  const medal = MEDALS[place];
  return (
    <View style={styles.stepCol}>
      <Pressable
        onPress={() => onOpen(row.user)}
        disabled={me}
        style={({ pressed }) => [styles.stepWho, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`@${row.user.username}'s profile`}
      >
        <View>
          <View style={[styles.ring, { borderColor: medal }]}>
            <Avatar user={row.user} size={place === 0 ? 60 : 48} />
          </View>
          {/* Tipped onto the photo's top-left, at about 11 o'clock — alfa's crown. */}
          {place === 0 ? (
            <View style={styles.crown} pointerEvents="none"><SimpleCrown size={26} color={medal} /></View>
          ) : null}
        </View>
        <Text style={[styles.stepName, me && styles.meName]} numberOfLines={1}>
          {me ? 'You' : `@${row.user.username}`}
        </Text>
      </Pressable>
      <View style={[styles.step, { height: STEP_H[place] }]}>
        <Text style={[styles.stepPlace, { color: medal }]}>{place + 1}</Text>
        <Text style={styles.stepValue} numberOfLines={1} adjustsFontSizeToFit>{row.valueLabel}</Text>
        {row.short ? <Text style={styles.stepShort} numberOfLines={1} adjustsFontSizeToFit>{row.short}</Text> : null}
      </View>
    </View>
  );
}

/** "4d 12h", "5h 20m", "12m" — a few days at most, so no seconds. */
const timeLeft = (ms: number) => {
  const m = Math.max(1, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d) return `${d}d ${h}h`;
  return h ? `${h}h ${m % 60}m` : `${m}m`;
};

/** When the board starts over: "Resets Monday · in 4d 12h". */
function ResetLine({ resetsAt }: { resetsAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, [resetsAt]);
  const ms = new Date(resetsAt).getTime() - now;
  if (!Number.isFinite(ms)) return null;
  const day = new Date(resetsAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  return (
    <View style={styles.reset}>
      <RefreshCw size={13} color="#A0A0A0" />
      <Text style={styles.resetText}>
        {ms > 0 ? `Resets ${day} · in ${timeLeft(ms)}` : 'Resetting now'}
      </Text>
    </View>
  );
}

/** The top three on steps — second, first, third, the way a podium stands. */
function Podium({ rows, me, onOpen }: { rows: RankedRow[]; me?: string; onOpen: (user: SpotUserLite) => void }) {
  const order = [1, 0, 2].filter((i) => rows[i]);
  return (
    <View style={styles.podium} accessibilityRole="summary">
      {order.map((i) => <Step key={rows[i].user.user_id} row={rows[i]} place={i} me={rows[i].user.user_id === me} onOpen={onOpen} />)}
    </View>
  );
}

/**
 * Everyone from fourth down, one bar each on the same scale, so the gaps
 * read at a glance. Your bar is in the brand colour; everyone else's grey.
 */
function BarRow({ row, rank, scale, me, onOpen }: {
  row: RankedRow;
  rank: number;
  scale: number;
  me: boolean;
  onOpen: (user: SpotUserLite) => void;
}) {
  const brand = useBrandColor();
  const pct = scale > 0 ? Math.max(0.03, Math.min(1, row.value / scale)) : 0;
  return (
    <Pressable
      onPress={() => onOpen(row.user)}
      disabled={me}
      style={({ pressed }) => [styles.row, me && { borderColor: brand }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`@${row.user.username}'s profile`}
    >
      <Text style={styles.rank}>{rank}</Text>
      <Avatar user={row.user} size={32} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, me && styles.meName]} numberOfLines={1}>{me ? 'You' : `@${row.user.username}`}</Text>
          <Text style={styles.value}>{row.valueLabel}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.bar, { width: `${pct * 100}%`, backgroundColor: me ? brand : '#5A5A5A' }]} />
        </View>
        <Text style={styles.detail} numberOfLines={1}>{row.detail}</Text>
      </View>
    </Pressable>
  );
}

/**
 * A leaderboard drawn to be read: the top three on a podium, and everyone
 * else as bars on one scale — yours in the brand colour, wherever you are.
 * The rows arrive ranked; this only draws them. Tapping anyone else opens them.
 */
export default function RankedBoard({
  rows: ranked, metric, me, onOpen, resetsAt, bottom, stale, refreshing, onRefresh, empty, top: topPad = 0, above, onScroll,
  inline = false, limit,
}: {
  rows: RankedRow[];
  metric: BoardMetric;
  me?: string;
  onOpen: (user: SpotUserLite) => void;
  /** When the board starts over, said above the podium. */
  resetsAt?: string;
  bottom: number;
  stale?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  empty: { title: string; message: string };
  /** Room above the list — the pane's floating header. */
  top?: number;
  /** Over the board, scrolling with it — the pane's game switcher. */
  above?: React.ReactNode;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /**
   * Drawn in place, as a plain column, rather than as its own scrolling
   * list — for a board inside a page that already scrolls (the Games tab,
   * under Today's Results). No gutters of its own; `bottom` and `top` unused.
   */
  inline?: boolean;
  /** At most this many rows, podium included — the Games tab's short board. */
  limit?: number;
}) {
  // Anyone I've blocked is left off; everyone under them moves up a place.
  const blocked = useBlockedIds();
  const unblocked = blocked.size ? ranked.filter((r) => !blocked.has(r.user.user_id)) : ranked;
  const rows = limit ? unblocked.slice(0, limit) : unblocked;
  // The rows arrive ranked, so whoever can't stand on the podium is already below it.
  const top = rows.slice(0, 3).filter((r) => r.podium !== false);
  const rest = rows.slice(top.length);
  const scale = metric.max ?? Math.max(1, ...rows.map((r) => r.value));

  const header = (
    <View style={styles.head}>
      {above}
      {/* What it's ranked by, in words. */}
      <View style={styles.metric}>
        <Text style={styles.metricName}>{metric.name}</Text>
        <Text style={styles.metricHow}>{metric.how}</Text>
      </View>
      {resetsAt ? <ResetLine resetsAt={resetsAt} /> : null}
      {top.length ? <Podium rows={top} me={me} onOpen={onOpen} /> : null}
    </View>
  );

  if (inline) {
    return (
      <View style={stale ? styles.stale : undefined}>
        {header}
        {rows.length ? null : <EmptyState title={empty.title} message={empty.message} />}
        <View style={styles.inlineRows}>
          {rest.map((item, index) => (
            <BarRow key={item.user.user_id} row={item} rank={index + top.length + 1} scale={scale} me={item.user.user_id === me} onOpen={onOpen} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      data={rest}
      keyExtractor={(r) => r.user.user_id}
      renderItem={({ item, index }) => (
        <BarRow row={item} rank={index + top.length + 1} scale={scale} me={item.user.user_id === me} onOpen={onOpen} />
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={rows.length ? null : <EmptyState title={empty.title} message={empty.message} />}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      contentContainerStyle={[styles.list, { paddingTop: topPad + 4, paddingBottom: bottom + 24 }]}
      onScroll={onScroll}
      scrollEventThrottle={16}
      style={stale ? styles.stale : undefined}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" /> : undefined}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: GUTTER, flexGrow: 1 },
  stale: { opacity: 0.6 },
  pressed: { opacity: 0.75 },
  head: { gap: 16, marginBottom: 10 },
  metric: { gap: 3, paddingHorizontal: 4 },
  metricName: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  metricHow: { color: '#A0A0A0', fontSize: 13, lineHeight: 18 },
  reset: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  resetText: { color: '#A0A0A0', fontSize: 13, fontWeight: '500' },

  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, paddingTop: 8 },
  stepCol: { flex: 1, maxWidth: 120, alignItems: 'stretch' },
  stepWho: { alignItems: 'center', gap: 6, marginBottom: 8 },
  crown: { position: 'absolute', top: -8, left: -6, transform: [{ rotate: '-30deg' }] },
  // Snug around the photo — the ring is its frame, no gap between.
  ring: { borderWidth: 2.5, borderRadius: 999 },
  stepName: { color: '#E0E0E0', fontSize: 12, fontWeight: '600', maxWidth: '100%' },
  meName: { color: '#FFFFFF', fontWeight: '800' },
  step: {
    backgroundColor: GAME_CARD, borderRadius: 10, paddingBottom: 14,
    alignItems: 'center', paddingTop: 8, paddingHorizontal: 6, gap: 2,
  },
  stepPlace: { fontSize: 22, fontWeight: '900' },
  stepValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  stepShort: { color: '#A0A0A0', fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },


  sep: { height: 8 },
  inlineRows: { gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    backgroundColor: GAME_CARD, borderRadius: COMMON_RADIUS, borderWidth: 1.5, borderColor: 'transparent',
  },
  rank: { width: 22, color: '#A0A0A0', fontSize: 14, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  rowBody: { flex: 1, minWidth: 0, gap: 5 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  value: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 4, backgroundColor: '#2A2A2A', overflow: 'hidden' },
  bar: { height: 8, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  detail: { color: '#A0A0A0', fontSize: 12 },
});
