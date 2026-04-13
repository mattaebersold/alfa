import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetCalendarEventsQuery } from '../../api/apiService';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Colors } from '../../constants/colors';
import type { SocietyStackParamList } from '../../navigation/types';
import type { Event } from '../../types/api';

type NavProp = NativeStackNavigationProp<SocietyStackParamList>;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarScreen() {
  const navigation = useNavigation<NavProp>();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-indexed for API

  const { data: calData, isLoading } = useGetCalendarEventsQuery({ year, month });
  const events = calData?.entries ?? [];

  // Build calendar grid
  const days = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const allDays = eachDayOfInterval({ start, end });
    const startPad = start.getDay(); // 0=Sun
    const padded: (Date | null)[] = Array(startPad).fill(null);
    return [...padded, ...allDays];
  }, [currentDate]);

  // Events on selected date
  const selectedEvents = useMemo(() => {
    if (!selectedDate) return events;
    return events.filter((e) => e.event_date && isSameDay(new Date(e.event_date), selectedDate));
  }, [selectedDate, events]);

  // Dates that have events
  const eventDates = useMemo(() => {
    return new Set(events.map((e) => e.event_date ? format(new Date(e.event_date), 'yyyy-MM-dd') : null).filter(Boolean));
  }, [events]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Month nav */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => setCurrentDate((d) => subMonths(d, 1))} style={styles.navBtn}>
          <ChevronLeft size={22} color={Colors.brg} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{format(currentDate, 'MMMM yyyy')}</Text>
        <TouchableOpacity onPress={() => setCurrentDate((d) => addMonths(d, 1))} style={styles.navBtn}>
          <ChevronRight size={22} color={Colors.brg} />
        </TouchableOpacity>
      </View>

      {/* Day labels */}
      <View style={styles.dayLabels}>
        {DAY_LABELS.map((d) => (
          <Text key={d} style={styles.dayLabel}>{d}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {days.map((day, i) => {
          if (!day) return <View key={`pad-${i}`} style={styles.dayCell} />;
          const key = format(day, 'yyyy-MM-dd');
          const hasEvents = eventDates.has(key);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());
          return (
            <TouchableOpacity
              key={key}
              style={[styles.dayCell, isSelected && styles.dayCellSelected, isToday && !isSelected && styles.dayCellToday]}
              onPress={() => setSelectedDate(isSelected ? null : day)}
            >
              <Text style={[styles.dayNum, isSelected && styles.dayNumSelected, isToday && !isSelected && styles.dayNumToday]}>
                {day.getDate()}
              </Text>
              {hasEvents && <View style={[styles.eventDot, isSelected && { backgroundColor: '#FFFFFF' }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Events for selected date or all events */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>
          {selectedDate ? format(selectedDate, 'MMMM d') : 'All Events'}
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
          keyExtractor={(e) => e.internal_id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.eventRow}
              onPress={() => navigation.navigate('EventDetail', { eventId: item.internal_id })}
              activeOpacity={0.7}
            >
              <View style={styles.eventDateBadge}>
                <Text style={styles.eventDay}>
                  {item.event_date ? format(new Date(item.event_date), 'd') : '—'}
                </Text>
                <Text style={styles.eventMon}>
                  {item.event_date ? format(new Date(item.event_date), 'MMM') : ''}
                </Text>
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
                {item.location && <Text style={styles.eventLocation} numberOfLines={1}>{item.location}</Text>}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<EmptyState title="No events" message={selectedDate ? 'No events on this day.' : 'No events this month.'} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.eventList}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.cream },
  monthNav:     {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  navBtn:       { padding: 6 },
  monthLabel:   { fontSize: 18, fontWeight: '800', color: Colors.fg },
  dayLabels:    {
    flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  dayLabel:     { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.grey },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, backgroundColor: '#FFFFFF', paddingBottom: 8 },
  dayCell:      { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 100 },
  dayCellSelected: { backgroundColor: Colors.brg },
  dayCellToday:    { backgroundColor: Colors.segment },
  dayNum:          { fontSize: 14, fontWeight: '600', color: Colors.fg },
  dayNumSelected:  { color: '#FFFFFF', fontWeight: '800' },
  dayNumToday:     { color: Colors.brg, fontWeight: '800' },
  eventDot:        { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.speed, marginTop: 2 },
  listHeader:   {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: Colors.segment, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border,
  },
  listHeaderText: { fontSize: 13, fontWeight: '800', color: Colors.grey, textTransform: 'uppercase', letterSpacing: 0.5 },
  clearDate:      { fontSize: 13, color: Colors.brg, fontWeight: '600' },
  eventList:    { paddingBottom: 24 },
  eventRow:     {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  eventDateBadge: { alignItems: 'center', width: 36 },
  eventDay:       { fontSize: 18, fontWeight: '800', color: Colors.brg },
  eventMon:       { fontSize: 11, fontWeight: '700', color: Colors.grey, textTransform: 'uppercase' },
  eventInfo:      { flex: 1 },
  eventTitle:     { fontSize: 15, fontWeight: '600', color: Colors.fg },
  eventLocation:  { fontSize: 13, color: Colors.grey, marginTop: 2 },
});
