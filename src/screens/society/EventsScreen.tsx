import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import ScreenHeading from '../../components/ui/ScreenHeading';
import SharedModal from '../../components/ui/SharedModal';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import EventCard from '../../components/cards/EventCard';
import EventMonthCalendar from '../../components/society/EventMonthCalendar';
import RallyCarousel from '../../components/society/RallyCarousel';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import { useGetUpcomingEventsQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { EVENT_CATEGORIES } from '../../constants/eventTypes';
import { useEventSheet } from '../../providers/EventSheetProvider';
import { ss } from '../../styles/shared';
import type { SocietyEvent } from '../../types/api';
import RowEndSpacer from '../../components/ui/RowEndSpacer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Cards stop short of full width so the next one peeks out of the carousel.
const CARD_WIDTH = SCREEN_WIDTH * 0.78;
/** How far ahead the Upcoming carousel looks. */
const UPCOMING_DAYS = 30;

/**
 * Events: the next 30 days as a carousel, then the month calendar. Tapping a
 * day opens the day's stack; tapping an event there closes the sheet and opens
 * the detail screen.
 */
export default function EventsScreen() {
  const colors = useColors();
  const brand = useBrandColor();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);

  const { openEventSheet } = useEventSheet();
  const [category, setCategory] = useState<string | null>(null);
  const [daySheet, setDaySheet] = useState<{ date: Date; events: SocietyEvent[] } | null>(null);
  // iOS won't present a screen while a modal is dismissing, so the tapped event
  // is held until the sheet is fully gone.
  const [pendingEvent, setPendingEvent] = useState<SocietyEvent | null>(null);

  // A rolling 30-day window rather than the calendar month: on the 28th, "the
  // rest of this month" is two days of events and the carousel looks abandoned.
  const { data, isLoading } = useGetUpcomingEventsQuery({
    limit: 20,
    days: UPCOMING_DAYS,
    ...(category ? { category } : {}),
  });
  const upcoming = data?.entries ?? [];

  const openEvent = (event: SocietyEvent) =>
    openEventSheet({ eventId: event.internal_id, occurrenceDate: event.occurrence_date });

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={{ paddingTop: headerPad, paddingBottom: 88 + insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <ScreenHeading
          title="Events"
          right={
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: brand }]}
              onPress={() => (nav as any).navigate('SocietyEventCreate')}
              hitSlop={8}
            >
              <Plus size={18} color="#000000" />
            </TouchableOpacity>
          }
        />

        {/* Category filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <TouchableOpacity
            style={[
              styles.chip,
              { borderColor: colors.border },
              !category && { backgroundColor: brand, borderColor: brand },
            ]}
            onPress={() => setCategory(null)}
          >
            <Text style={[styles.chipText, { color: !category ? '#000000' : colors.fg }]}>All</Text>
          </TouchableOpacity>
          {EVENT_CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[
                  styles.chip,
                  { borderColor: colors.border },
                  active && { backgroundColor: c.color, borderColor: c.color },
                ]}
                onPress={() => setCategory(active ? null : c.key)}
              >
                <Text style={[styles.chipText, { color: active ? '#000000' : colors.fg }]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
          <RowEndSpacer />
        </ScrollView>

        {/* Upcoming carousel — the next 30 days, from today forward */}
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: colors.fg }]}>Upcoming</Text>
          <Text style={[styles.sectionSub, { color: colors.grey }]}>
            Next {UPCOMING_DAYS} days
          </Text>
        </View>

        {isLoading ? (
          <Spinner />
        ) : upcoming.length === 0 ? (
          <EmptyState title={`Nothing in the next ${UPCOMING_DAYS} days`} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
            snapToInterval={CARD_WIDTH + 12}
            snapToAlignment="start"
            decelerationRate="fast"
          >
            {upcoming.map((event, i) => (
              <EventCard
                key={`${event.internal_id}-${event.day}-${i}`}
                event={event}
                width={CARD_WIDTH}
                onPress={openEvent}
              />
            ))}
            <RowEndSpacer />
          </ScrollView>
        )}

        {/* Month calendar */}
        <View style={{ marginTop: 24 }}>
          <EventMonthCalendar
            category={category ?? undefined}
            onSelectDay={(date, events) => setDaySheet({ date, events })}
          />
        </View>

        <RallyCarousel />
      </ScrollView>

      {/* A day's events */}
      <SharedModal
        visible={!!daySheet}
        onClose={() => setDaySheet(null)}
        onDismissed={() => {
          if (pendingEvent) {
            const event = pendingEvent;
            setPendingEvent(null);
            openEvent(event);
          }
        }}
        title={
          daySheet
            ? daySheet.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
            : ''
        }
      >
        <View style={styles.sheetBody}>
          {(daySheet?.events ?? []).map((event, i) => (
            <EventCard
              key={`${event.internal_id}-${i}`}
              event={event}
              onPress={(e) => { setPendingEvent(e); setDaySheet(null); }}
            />
          ))}
        </View>
      </SharedModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  createBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  filterRow: { paddingLeft: 12, gap: 8, paddingBottom: 4 },
  chip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  chipText:  { fontSize: 12, fontWeight: '700' },

  sectionHead: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800' },
  sectionSub:   { fontSize: 13, fontWeight: '600' },

  carousel: { paddingLeft: 12, gap: 12 },

  sheetBody: { padding: 12, gap: 12, paddingBottom: 32 },
});
