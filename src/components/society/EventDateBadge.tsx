import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';
import { calendarDate } from '../../utils/calendarDate';

/**
 * Torn-off calendar page: red month strip over a big day number and weekday on
 * white. Shared by the event card and the event detail so a date reads the same
 * in both. `size="sm"` is the card version.
 *
 * The colours are fixed rather than themed. The badge's whole job is to look
 * like a page off a wall calendar, and it sits on a photograph in both places it
 * appears — a dark-mode version would be a dark rectangle on a dark scrim,
 * which is neither legible nor a calendar.
 */
export default function EventDateBadge({
  date,
  size = 'md',
}: {
  date?: string | null;
  size?: 'sm' | 'md';
}) {
  // A stored day, not an instant — see utils/calendarDate. Parsed as one, the
  // badge showed the day before for every user west of UTC.
  const d = calendarDate(date);
  if (!d) return null;

  const sm = size === 'sm';

  return (
    <View style={[styles.wrap, sm && styles.wrapSm]}>
      <View style={styles.month}>
        <Text style={[styles.monthText, sm && styles.monthTextSm]}>
          {d.toLocaleDateString('en-US', { month: 'short' })}
        </Text>
      </View>
      <View style={sm ? styles.bodySm : styles.body}>
        <Text style={sm ? styles.daySm : styles.day}>{d.getDate()}</Text>
        <Text style={sm ? styles.weekdaySm : styles.weekday}>
          {d.toLocaleDateString('en-US', { weekday: 'short' })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 62, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    // On a photo the badge defines itself; on the event detail's own white
    // sheet it would otherwise be a red strip floating over nothing.
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.18)',
  },
  wrapSm: { width: 50, borderRadius: 10 },

  month:      { paddingVertical: 3, alignItems: 'center', backgroundColor: colors.guards },
  monthText:  {
    fontSize: 10, fontWeight: '800', color: '#FFFFFF',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  monthTextSm: { fontSize: 9 },

  body:   { paddingVertical: 5, alignItems: 'center' },
  bodySm: { paddingVertical: 3, alignItems: 'center' },

  day:    { fontSize: 24, fontWeight: '800', lineHeight: 26, color: '#141414' },
  daySm:  { fontSize: 19, fontWeight: '800', lineHeight: 21, color: '#141414' },

  weekday: {
    fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1,
    color: colors.greyDark,
  },
  weekdaySm: {
    fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1,
    color: colors.greyDark,
  },
});
