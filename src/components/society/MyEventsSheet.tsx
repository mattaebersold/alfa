import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import SharedModal from '../ui/SharedModal';
import SubTabs from '../ui/SubTabs';
import EmptyState from '../ui/EmptyState';
import Spinner from '../ui/Spinner';
import ExpandableEventCard from './ExpandableEventCard';
import { useGetMyEventsQuery } from '../../api/apiService';
import type { SocietyEvent } from '../../types/api';

type Tab = 'upcoming' | 'past';
const TABS: { key: Tab; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
];

/**
 * "My Events" — everything you've flagged interest in. Upcoming, soonest
 * first, by default; events whose schedule has run out are under Past. The
 * cards open in place, like the calendar's day pane, so the event detail pane
 * is a step you only take for comments and posts.
 */
export default function MyEventsSheet({
  visible, onClose, onSelectEvent,
}: {
  visible: boolean;
  onClose: () => void;
  /** The whole event — comments, tagged posts — from an open card's link. */
  onSelectEvent: (event: SocietyEvent) => void;
}) {
  const { data, isLoading } = useGetMyEventsQuery(undefined, { skip: !visible });
  const [tab, setTab] = useState<Tab>('upcoming');
  const [openId, setOpenId] = useState<string | null>(null);

  const entries = data?.entries ?? [];
  const shown = tab === 'upcoming'
    ? entries.filter((e) => e.next_occurrence)
    : entries.filter((e) => !e.next_occurrence);

  return (
    <SharedModal
      visible={visible}
      onClose={onClose}
      onDismissed={() => { setTab('upcoming'); setOpenId(null); }}
      title="My Events"
      headFade={false}
      // Full height either tab, so switching doesn't resize the pane.
      heightRatio={0.9}
    >
      <View style={styles.tabs}>
        <SubTabs options={TABS} value={tab} onChange={(k) => { setTab(k); setOpenId(null); }} />
      </View>
      {/* Scrolls: the cards take their photos' own heights, so a handful of
          them run past the sheet, and the sheet clips whatever it's handed. */}
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <Spinner />
        ) : shown.length === 0 ? (
          tab === 'upcoming' ? (
            <EmptyState
              title="Nothing coming up"
              message="Tap Attend on an event to keep it here."
            />
          ) : <EmptyState title="No past events" />
        ) : (
          shown.map((event) => {
            // One row per date you're going to — a weekly meet can be here twice.
            const key = `${event.internal_id}-${event.day ?? ''}`;
            return (
            <ExpandableEventCard
              key={key}
              event={event}
              expanded={openId === key}
              onToggleExpanded={() => setOpenId(openId === key ? null : key)}
              onOpenFull={onSelectEvent}
            />
            );
          })
        )}
      </ScrollView>
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingTop: 4 },
  body: { padding: 12, gap: 12, paddingBottom: 32 },
});
