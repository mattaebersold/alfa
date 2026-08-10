import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';

/**
 * Torn-off calendar page: month strip over a big day number and weekday.
 * Shared by the event card and the event detail so a date reads the same in
 * both. `size="sm"` is the card version.
 */
export default function EventDateBadge({
  date,
  size = 'md',
}: {
  date?: string | null;
  size?: 'sm' | 'md';
}) {
  const colors = useColors();
  const brand = useBrandColor();
  if (!date) return null;

  const d = new Date(date);
  const sm = size === 'sm';

  return (
    <View style={[styles.wrap, sm && styles.wrapSm, { backgroundColor: colors.card }]}>
      <View style={[styles.month, { backgroundColor: brand }]}>
        <Text style={[styles.monthText, sm && styles.monthTextSm]}>
          {d.toLocaleDateString('en-US', { month: 'short' })}
        </Text>
      </View>
      <View style={sm ? styles.bodySm : styles.body}>
        <Text style={[sm ? styles.daySm : styles.day, { color: colors.fg }]}>{d.getDate()}</Text>
        <Text style={[sm ? styles.weekdaySm : styles.weekday, { color: colors.grey }]}>
          {d.toLocaleDateString('en-US', { weekday: 'short' })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:   { width: 62, borderRadius: 12, overflow: 'hidden' },
  wrapSm: { width: 50, borderRadius: 10 },

  month:      { paddingVertical: 2, alignItems: 'center' },
  monthText:  {
    fontSize: 10, fontWeight: '800', color: '#000000',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  monthTextSm: { fontSize: 9 },

  body:   { paddingVertical: 5, alignItems: 'center' },
  bodySm: { paddingVertical: 3, alignItems: 'center' },

  day:    { fontSize: 24, fontWeight: '800', lineHeight: 26 },
  daySm:  { fontSize: 19, fontWeight: '800', lineHeight: 21 },

  weekday:   { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 },
  weekdaySm: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 },
});
