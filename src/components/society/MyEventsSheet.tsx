import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SharedModal from '../ui/SharedModal';
import EmptyState from '../ui/EmptyState';
import Spinner from '../ui/Spinner';
import EventCard from '../cards/EventCard';
import { useGetMyEventsQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import type { SocietyEvent } from '../../types/api';

/**
 * "Your Events" — everything you've flagged interest in, soonest first. Events
 * whose schedule has run out move to a past section rather than vanishing.
 */
export default function MyEventsSheet({
  visible, onClose, onSelectEvent,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectEvent: (event: SocietyEvent) => void;
}) {
  const colors = useColors();
  const { data, isLoading } = useGetMyEventsQuery(undefined, { skip: !visible });

  const entries = data?.entries ?? [];
  const upcoming = entries.filter((e) => e.next_occurrence);
  const past = entries.filter((e) => !e.next_occurrence);

  return (
    <SharedModal visible={visible} onClose={onClose} title="Your Events">
      <View style={styles.body}>
        {isLoading ? (
          <Spinner />
        ) : entries.length === 0 ? (
          <EmptyState
            title="No events saved yet"
            message="Tap Interested on an event to keep it here."
          />
        ) : (
          <>
            {upcoming.map((event) => (
              <EventCard key={event.internal_id} event={event} variant="row" onPress={onSelectEvent} />
            ))}

            {past.length > 0 && (
              <>
                <Text style={[styles.pastLabel, { color: colors.grey }]}>PAST</Text>
                <View style={{ opacity: 0.6, gap: 12 }}>
                  {past.map((event) => (
                    <EventCard key={event.internal_id} event={event} variant="row" onPress={onSelectEvent} />
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </View>
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  body: { padding: 12, gap: 12, paddingBottom: 32 },
  pastLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginTop: 12 },
});
