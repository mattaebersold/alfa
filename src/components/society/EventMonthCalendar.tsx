import React, { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useGetEventCalendarQuery, useGetRallysQuery } from '../../api/apiService';
import RallyDetailSheet from './RallyDetailSheet';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import { categoryFor, toDayKey } from '../../constants/eventTypes';
import { calendarDate } from '../../utils/calendarDate';
import { rallyColors } from '../../utils/rally';
import type { SocietyEvent, Rally } from '../../types/api';

const WEEK_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** More rallys than a month will ever hold, so one page always covers it. */
const RALLY_LIMIT = 50;

/**
 * Livery for an ORS-sponsored event.
 *
 * Fixed, because unlike a rally these carry no colours of their own — and
 * deliberately nothing like any rally's, so the two kinds of painted day never
 * read as the same thing. Both are dark enough to take white.
 */
const ORS_EVENT_GRADIENT: [string, string] = ['#1E8E4E', '#6B3FA0'];

/**
 * A day given over to one thing.
 *
 * Rallys and ORS events don't get a dot — they take the whole cell, painted in
 * their colours with the club's mark on them. A dot the same size as a
 * cars-and-coffee dot said these were the same size of occasion, and they
 * aren't. The livery is what identifies the day, so "today" rings the tile
 * rather than repainting it.
 */
function PaintedDay({
  gradient,
  dayNumber,
  ringColor,
  otherEvents,
}: {
  gradient: [string, string];
  dayNumber: number;
  /** Set on today, which would otherwise have nowhere to show. */
  ringColor?: string;
  /** Anything else on this day the tile doesn't already stand for. */
  otherEvents: number;
}) {
  const [from, to] = gradient;
  const ink = contrastText(from);

  return (
    <View style={[styles.paintedTile, !!ringColor && { borderWidth: 2, borderColor: ringColor }]}>
      <LinearGradient
        colors={[from, to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={[styles.paintedDayText, { color: ink }]}>{dayNumber}</Text>
      <Image
        source={require('../../../assets/logo.png')}
        style={styles.paintedLogo}
        tintColor={ink}
      />
      {/* So a painted day never hides that something else is on. */}
      {otherEvents > 0 && (
        <View style={styles.paintedDots}>
          {Array.from({ length: Math.min(otherEvents, 3) }).map((_, i) => (
            <View key={i} style={[styles.paintedDot, { backgroundColor: ink }]} />
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * Month grid with a coloured dot per event on a day. Weeks run Monday-first.
 *
 * The server returns occurrences already keyed by "YYYY-MM-DD", so repeating
 * events land on their days without the client understanding schedules.
 *
 * Two kinds of day are painted instead of dotted — see PaintedDay. A rally wins
 * over an ORS event on the same date: it's the rarer of the two, and only one
 * tile fits.
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
  const [selectedRallyId, setSelectedRallyId] = useState<string | null>(null);

  const { data, isFetching } = useGetEventCalendarQuery({
    year: cursor.getFullYear(),
    month: cursor.getMonth(),
    ...(category ? { category } : {}),
  });

  // Note the +1: the events calendar takes a 0-indexed month and the rally
  // list a 1-indexed one. They are different endpoints with different habits.
  const { data: rallyData } = useGetRallysQuery({
    year: cursor.getFullYear(),
    month: cursor.getMonth() + 1,
    limit: RALLY_LIMIT,
  });

  const days = data?.days ?? {};
  const todayKey = toDayKey(today);

  /** One rally per day — two on a date would be a smear at this size. */
  const rallysByDay = useMemo(() => {
    const map = new Map<string, Rally>();
    for (const rally of rallyData?.entries ?? []) {
      const day = calendarDate(rally.event_date);
      if (!day) continue;
      const key = toDayKey(day);
      if (!map.has(key)) map.set(key, rally);
    }
    return map;
  }, [rallyData]);

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
          const ring = isToday ? colors.fg : undefined;

          const rally = rallysByDay.get(key);
          if (rally) {
            return (
              <TouchableOpacity
                key={key}
                style={styles.cell}
                onPress={() => setSelectedRallyId(rally.internal_id)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} — ${rally.title ?? 'Rally'}`}
              >
                <PaintedDay
                  gradient={rallyColors(rally, brand)}
                  dayNumber={date.getDate()}
                  ringColor={ring}
                  otherEvents={dayEvents.length}
                />
              </TouchableOpacity>
            );
          }

          const orsEvent = dayEvents.find((e) => e.ors_sponsored);
          if (orsEvent) {
            return (
              <TouchableOpacity
                key={key}
                style={styles.cell}
                onPress={() => onSelectDay(date, dayEvents)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} — ${orsEvent.title ?? 'ORS event'}`}
              >
                <PaintedDay
                  gradient={ORS_EVENT_GRADIENT}
                  dayNumber={date.getDate()}
                  ringColor={ring}
                  // The tile already stands for the sponsored one.
                  otherEvents={dayEvents.length - 1}
                />
              </TouchableOpacity>
            );
          }

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

      <RallyDetailSheet rallyId={selectedRallyId} onClose={() => setSelectedRallyId(null)} />
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

  // A painted day fills its cell rather than sitting inside it — inset just
  // enough to stay a tile in a grid rather than a band across the week.
  paintedTile: {
    position: 'absolute', top: 2, left: 3, right: 3, bottom: 2,
    borderRadius: 9, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  paintedDayText: { fontSize: 12, fontWeight: '800' },
  paintedLogo:    { width: 16, height: 16, opacity: 0.95 },
  paintedDots:    { flexDirection: 'row', gap: 3, marginTop: 1 },
  paintedDot:     { width: 4, height: 4, borderRadius: 2, opacity: 0.85 },
});
