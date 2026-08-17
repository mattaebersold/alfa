import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react-native';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { useGetCalendarEventsQuery, useGetRallysQuery } from '../../api/apiService';
import EventDetailSheet from '../../components/society/EventDetailSheet';
import RallyDetailSheet from '../../components/society/RallyDetailSheet';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import { rallyColors } from '../../utils/rally';
import type { Rally } from '../../types/api';
import { ss } from '../../styles/shared';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** How many rallys a month realistically holds — one page covers it. */
const RALLY_LIMIT = 50;

export default function CalendarScreen() {
  const colors = useColors();
  const brand = useBrandColor();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedRallyId, setSelectedRallyId] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-indexed for API

  const { data: calData, isLoading } = useGetCalendarEventsQuery({ year, month });
  const { data: rallyData } = useGetRallysQuery({ year, month, limit: RALLY_LIMIT });
  // Future events only, de-duplicated — past events are hidden from the calendar.
  const events = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const seen = new Set<string>();
    return (calData?.entries ?? []).filter(
      (e) =>
        e.event_date &&
        new Date(e.event_date) >= today &&
        e.internal_id &&
        !seen.has(e.internal_id) &&
        seen.add(e.internal_id),
    );
  }, [calData]);

  // Build calendar grid
  const days = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const allDays = eachDayOfInterval({ start, end });
    const startPad = start.getDay(); // 0=Sun
    const padded: (Date | null)[] = Array(startPad).fill(null);
    return [...padded, ...allDays];
  }, [currentDate]);

  // Events on selected date, or upcoming events when none selected
  const selectedEvents = useMemo(() => {
    if (selectedDate) {
      return events.filter((e) => e.event_date && isSameDay(new Date(e.event_date), selectedDate));
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return events.filter((e) => e.event_date && new Date(e.event_date) >= today);
  }, [selectedDate, events]);

  // Dates that have events
  const eventDates = useMemo(() => {
    return new Set(events.map((e) => e.event_date ? format(new Date(e.event_date), 'yyyy-MM-dd') : null).filter(Boolean));
  }, [events]);

  /**
   * Rally per day, keyed by date.
   *
   * Unlike events these aren't filtered to the future: a rally's tile is the
   * loudest thing on the month, and having it vanish the morning after would
   * read as the calendar losing data rather than as tidiness. A day with two
   * rallys shows the first — the tile is one gradient, and two on a cell that's
   * a seventh of the screen wide would be a smear.
   */
  const rallysByDate = useMemo(() => {
    const map = new Map<string, Rally>();
    for (const rally of rallyData?.entries ?? []) {
      if (!rally.event_date) continue;
      const key = format(new Date(rally.event_date), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, rally);
    }
    return map;
  }, [rallyData]);

  const selectedRallys = useMemo(() => {
    const all = rallyData?.entries ?? [];
    if (!selectedDate) return all;
    return all.filter((r) => r.event_date && isSameDay(new Date(r.event_date), selectedDate));
  }, [selectedDate, rallyData]);

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      {/* Month nav */}
      <View style={[styles.monthNav, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setCurrentDate((d) => subMonths(d, 1))} style={styles.navBtn}>
          <ChevronLeft size={22} color={colors.primaryAlt} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.fg }]}>{format(currentDate, 'MMMM yyyy')}</Text>
        <TouchableOpacity onPress={() => setCurrentDate((d) => addMonths(d, 1))} style={styles.navBtn}>
          <ChevronRight size={22} color={colors.primaryAlt} />
        </TouchableOpacity>
      </View>

      {/* Day labels */}
      <View style={[styles.dayLabels, { backgroundColor: colors.card }]}>
        {DAY_LABELS.map((d) => (
          <Text key={d} style={[styles.dayLabel, { color: colors.grey }]}>{d}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={[styles.grid, { backgroundColor: colors.card }]}>
        {days.map((day, i) => {
          if (!day) return <View key={`pad-${i}`} style={styles.dayCell} />;
          const key = format(day, 'yyyy-MM-dd');
          const hasEvents = eventDates.has(key);
          const rally = rallysByDate.get(key);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());

          // A rally day is a painted tile rather than a number with a dot under
          // it. The livery carries the identity, so selection and today can't
          // repaint the fill — they ring it instead.
          if (rally) {
            const [primary, secondary] = rallyColors(rally, brand);
            const ink = contrastText(primary);
            return (
              <View key={key} style={styles.dayCell}>
                <TouchableOpacity
                  style={[
                    styles.rallyTile,
                    isSelected && { borderWidth: 2.5, borderColor: colors.fg },
                    isToday && !isSelected && { borderWidth: 2, borderColor: colors.fg },
                  ]}
                  onPress={() => setSelectedDate(isSelected ? null : day)}
                  activeOpacity={0.85}
                  accessibilityLabel={`${format(day, 'MMMM d')} — ${rally.title ?? 'Rally'}`}
                >
                  <LinearGradient
                    colors={[primary, secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={[styles.rallyDayNum, { color: ink }]}>{day.getDate()}</Text>
                  <Flag size={9} color={ink} strokeWidth={2.5} style={styles.rallyFlag} />
                </TouchableOpacity>
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.dayCell,
                isSelected && styles.dayCellSelected,
                isToday && !isSelected && { backgroundColor: colors.segment },
              ]}
              onPress={() => setSelectedDate(isSelected ? null : day)}
            >
              <Text style={[
                styles.dayNum,
                { color: colors.fg },
                isSelected && styles.dayNumSelected,
                isToday && !isSelected && { color: colors.primaryAlt, fontWeight: '800' },
              ]}>
                {day.getDate()}
              </Text>
              {hasEvents && <View style={[styles.eventDot, isSelected && { backgroundColor: '#FFFFFF' }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Events for selected date or all events */}
      <View style={[styles.listHeader, { backgroundColor: colors.segment, borderColor: colors.border }]}>
        <Text style={[styles.listHeaderText, { color: colors.grey }]}>
          {selectedDate ? format(selectedDate, 'MMMM d') : 'Upcoming Events'}
        </Text>
        {selectedDate && (
          <TouchableOpacity onPress={() => setSelectedDate(null)}>
            <Text style={styles.clearDate}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? <Spinner fullScreen /> : (
        <FlatList
          data={selectedEvents}
          keyExtractor={(e, i) => e.internal_id ?? String(i)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.eventRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
              onPress={() => setSelectedEventId(item.internal_id)}
              activeOpacity={0.7}
            >
              <View style={styles.eventDateBadge}>
                <Text style={styles.eventDay}>
                  {item.event_date ? format(new Date(item.event_date), 'd') : '—'}
                </Text>
                <Text style={[styles.eventMon, { color: colors.grey }]}>
                  {item.event_date ? format(new Date(item.event_date), 'MMM') : ''}
                </Text>
              </View>
              <View style={styles.eventInfo}>
                <Text style={[styles.eventTitle, { color: colors.fg }]} numberOfLines={1}>{item.title}</Text>
                {item.location && <Text style={[styles.eventLocation, { color: colors.grey }]} numberOfLines={1}>{item.location}</Text>}
              </View>
            </TouchableOpacity>
          )}
          ListHeaderComponent={
            selectedRallys.length > 0 ? (
              <View style={styles.rallyCards}>
                {selectedRallys.map((rally) => {
                  const [primary, secondary] = rallyColors(rally, brand);
                  const ink = contrastText(primary);
                  return (
                    <TouchableOpacity
                      key={rally.internal_id}
                      onPress={() => setSelectedRallyId(rally.internal_id)}
                      activeOpacity={0.9}
                      style={styles.rallyCard}
                    >
                      <LinearGradient
                        colors={[primary, secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.rallyCardFill}
                      >
                        <Flag size={16} color={ink} strokeWidth={2.5} />
                        <View style={ss.fill}>
                          <Text style={[styles.rallyCardLabel, { color: ink }]}>
                            Rally{rally.event_date ? ` · ${format(new Date(rally.event_date), 'MMM d')}` : ''}
                          </Text>
                          <Text style={[styles.rallyCardTitle, { color: ink }]} numberOfLines={1}>
                            {rally.title}
                          </Text>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null
          }
          ListEmptyComponent={
            selectedRallys.length > 0
              ? null
              : <EmptyState title="No events" message={selectedDate ? 'No events on this day.' : 'No upcoming events this month.'} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.eventList}
        />
      )}

      <EventDetailSheet eventId={selectedEventId} onClose={() => setSelectedEventId(null)} />
      <RallyDetailSheet rallyId={selectedRallyId} onClose={() => setSelectedRallyId(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  monthNav:     {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  navBtn:       { padding: 6 },
  monthLabel:   { fontSize: 18, fontWeight: '800' },
  dayLabels:    {
    flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6,
  },
  dayLabel:     { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingBottom: 8 },
  dayCell:      { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 100 },
  dayCellSelected: { backgroundColor: colors.primaryAlt },
  dayNum:          { fontSize: 14, fontWeight: '600' },
  dayNumSelected:  { color: '#FFFFFF', fontWeight: '800' },
  eventDot:        { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.primaryAlt, marginTop: 2 },
  // Inset inside the cell so neighbouring tiles don't touch, and square-ish
  // rather than round — a filled circle at this size reads as a badge stuck to
  // the date, where a tile reads as the day itself being claimed.
  rallyTile:       {
    position: 'absolute', top: 3, left: 3, right: 3, bottom: 3,
    borderRadius: 8, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  rallyDayNum:     { fontSize: 14, fontWeight: '800' },
  rallyFlag:       { marginTop: 1, opacity: 0.9 },

  rallyCards:      { paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  rallyCard:       { borderRadius: 12, overflow: 'hidden' },
  rallyCardFill:   { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  rallyCardLabel:  { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, opacity: 0.85 },
  rallyCardTitle:  { fontSize: 15, fontWeight: '800', marginTop: 2 },
  listHeader:   {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderBottomWidth: 1,
  },
  listHeaderText: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  clearDate:      { fontSize: 13, color: colors.primaryAlt, fontWeight: '600' },
  eventList:    { paddingBottom: 24 },
  eventRow:     {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  eventDateBadge: { alignItems: 'center', width: 36 },
  eventDay:       { fontSize: 18, fontWeight: '800', color: colors.primaryAlt },
  eventMon:       { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  eventInfo:      { flex: 1 },
  eventTitle:     { fontSize: 15, fontWeight: '600' },
  eventLocation:  { fontSize: 13, marginTop: 2 },
});
