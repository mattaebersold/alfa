import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useGetEventCalendarQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { categoryFor, toDayKey } from '../../constants/eventTypes';
import type { SocietyEvent } from '../../types/api';

const WEEK_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Month grid with a coloured dot per event on a day. Weeks run Monday-first.
 *
 * The server returns occurrences already keyed by "YYYY-MM-DD", so repeating
 * events land on their days without the client understanding schedules.
 */
export default function EventMonthCalendar({
  onSelectDay,
  category,
}: {
  onSelectDay: (date: Date, events: SocietyEvent[]) => void;
  category?: string;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const { data, isFetching } = useGetEventCalendarQuery({
    year: cursor.getFullYear(),
    month: cursor.getMonth(),
    ...(category ? { category } : {}),
  });

  const days = data?.days ?? {};
  const todayKey = toDayKey(today);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    // getDay() is Sunday-first; shift so Monday is column 0.
    const lead = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const out: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(year, month, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  return (
    <View style={[styles.wrap, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => shiftMonth(-1)}
          style={[styles.navBtn, { backgroundColor: colors.segment }]}
          hitSlop={8}
        >
          <ChevronLeft size={16} color={colors.fg} />
        </TouchableOpacity>

        <Text style={[styles.monthLabel, { color: colors.fg }]}>
          {cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>

        <TouchableOpacity
          onPress={() => shiftMonth(1)}
          style={[styles.navBtn, { backgroundColor: colors.segment }]}
          hitSlop={8}
        >
          <ChevronRight size={16} color={colors.fg} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekHeader}>
        {WEEK_HEADERS.map((d) => (
          <Text key={d} style={[styles.weekHeaderText, { color: colors.grey }]}>{d}</Text>
        ))}
      </View>

      <View style={[styles.grid, isFetching && { opacity: 0.5 }]}>
        {cells.map((date, i) => {
          if (!date) return <View key={`blank-${i}`} style={styles.cell} />;

          const key = toDayKey(date);
          const dayEvents = days[key] ?? [];
          const isToday = key === todayKey;
          const hasEvents = dayEvents.length > 0;

          return (
            <TouchableOpacity
              key={key}
              style={styles.cell}
              disabled={!hasEvents}
              onPress={() => onSelectDay(date, dayEvents)}
              activeOpacity={0.7}
            >
              <View style={[styles.dayCircle, isToday && { backgroundColor: brand }]}>
                <Text
                  style={[
                    styles.dayText,
                    { color: isToday ? '#000000' : hasEvents ? colors.fg : colors.grey },
                    (isToday || hasEvents) && { fontWeight: '800' },
                  ]}
                >
                  {date.getDate()}
                </Text>
              </View>

              {/* One dot per event, coloured by its category, capped at three so
                  a busy day doesn't grow the row. */}
              <View style={styles.dots}>
                {dayEvents.slice(0, 3).map((e, idx) => (
                  <View
                    key={`${e.internal_id}-${idx}`}
                    style={[styles.dot, { backgroundColor: categoryFor(e.category).color }]}
                  />
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:   { borderRadius: 14, padding: 12, marginHorizontal: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  navBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 17, fontWeight: '800' },

  weekHeader: { flexDirection: 'row', marginBottom: 6 },
  weekHeaderText: {
    flex: 1, textAlign: 'center',
    fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // Seven per row; the fixed height keeps every week the same regardless of dots.
  cell: { width: `${100 / 7}%`, height: 56, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14 },
  dots: { flexDirection: 'row', gap: 4, height: 9, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
