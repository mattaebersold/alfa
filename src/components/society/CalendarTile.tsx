import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { COLOR_WHITE, SURFACE_BLACK, SURFACE_DARK } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * A day as a little desk calendar, darker than the card it sits on — black,
 * with a dark grey band: a band with the month over the
 * day's number, and the year under it when asked — the event and rally cards'
 * date.
 */
export default function CalendarTile({ date, year = false }: {
  date: Date;
  /** The year under the day — for a rally, often booked a year out. */
  year?: boolean;
}) {
  return (
    <View style={styles.cal}>
      <View style={styles.month}>
        <Text style={styles.monthText}>{date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</Text>
      </View>
      <Text style={styles.day}>{date.getDate()}</Text>
      {year ? <Text style={styles.year}>{date.getFullYear()}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cal: {
    width: 34, borderRadius: 5, overflow: 'hidden', alignItems: 'center',
    backgroundColor: SURFACE_BLACK,
  },
  month: { alignSelf: 'stretch', backgroundColor: SURFACE_DARK, paddingVertical: 1, alignItems: 'center' },
  monthText: { fontSize: 8.5, lineHeight: 11, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.5, color: 'rgba(255,255,255,0.85)' },
  day: { fontSize: 16, lineHeight: 20, fontFamily: FONT_INTER.extrabold, color: COLOR_WHITE, fontVariant: ['tabular-nums'] },
  year: { fontSize: 8.5, lineHeight: 10, marginTop: -1, paddingBottom: 2, fontFamily: FONT_INTER.bold, color: 'rgba(255,255,255,0.6)', fontVariant: ['tabular-nums'] },
});
