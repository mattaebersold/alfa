import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import { COLOR_WHITE } from '../../constants/config';
import { countdown } from './game';

/**
 * Time left until the games reset — the clock, "Resets in" and the time, in white. Display only — the screens turn over to the
 * new day themselves (useDayTurnover), whether or not this is showing.
 */
export default function Countdown({ nextAt, label = 'Resets in', small = false }: {
  nextAt: string;
  label?: string;
  /** The landing buttons' size, left-aligned. */
  small?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [nextAt]);
  const left = countdown(nextAt, now);
  return (
    <View style={[styles.wrap, small && styles.wrapSmall]}>
      <Clock size={small ? 13 : 16} color={COLOR_WHITE} />
      <Text style={[styles.label, small && styles.labelSmall]}>{label}</Text>
      <Text style={[styles.time, small && styles.timeSmall]}>{left ?? 'moments'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  wrapSmall: { justifyContent: 'flex-start', gap: 5 },
  label: { color: COLOR_WHITE, fontSize: 14 },
  labelSmall: { fontSize: 12 },
  time: { color: COLOR_WHITE, fontSize: 16, fontWeight: '400', fontVariant: ['tabular-nums'] },
  timeSmall: { fontSize: 12 },
});
