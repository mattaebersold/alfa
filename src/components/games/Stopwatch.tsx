import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Timer } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import { COLOR_GRAY_160, COLOR_GRAY_224 } from '../../constants/config';
import { formatElapsed, GAME_INSET } from './game';

const seenKey = (day: string) => `daily_game_seen_${day}`;

/**
 * The stopwatch's zero: when this game's photo showed. A new game (`fresh`,
 * nothing guessed yet) starts from now. Once a guess is in, the zero is kept
 * on the phone, so leaving mid-game and coming back picks the same clock up.
 * Null until `running` first turns true.
 */
export function useStopwatchStart(day: string, running: boolean, fresh: boolean): number | null {
  const [start, setStart] = useState<number | null>(null);
  const asked = useRef(false);
  useEffect(() => {
    if (!running || asked.current) return;
    asked.current = true;
    const now = Date.now();
    if (fresh) {
      setStart(now);
      SecureStore.setItemAsync(seenKey(day), String(now)).catch(() => {});
      return;
    }
    SecureStore.getItemAsync(seenKey(day))
      .then((saved) => {
        const at = Number(saved);
        if (saved && Number.isFinite(at) && at <= now) { setStart(at); return; }
        setStart(now);
        SecureStore.setItemAsync(seenKey(day), String(now)).catch(() => {});
      })
      // No storage: this visit's clock is better than none.
      .catch(() => setStart(now));
  }, [day, running, fresh]);
  return start;
}

/**
 * The time since the photo first showed, ticking. Display only — the reading
 * sent with a guess is worked out from the same start when it's sent.
 */
export default function Stopwatch({ start }: { start: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (start == null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [start]);
  return (
    <View style={styles.wrap} accessibilityLabel={start == null ? 'Timer' : `Time ${formatElapsed(now - start)}`}>
      <Timer size={14} color={COLOR_GRAY_160} />
      <Text style={styles.text}>{start == null ? '0:00' : formatElapsed(now - start)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // A pill on the attempt bar's height, so the two read as one row.
  wrap: {
    height: 28, borderRadius: 14, backgroundColor: GAME_INSET,
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10,
  },
  text: { color: COLOR_GRAY_224, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'], minWidth: 34 },
});
