import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SharedModal from '../ui/SharedModal';
import { EventDetailBody, EventInterestBar } from './EventDetailBody';
import { useGetSocietyEventQuery } from '../../api/apiService';

/**
 * Event detail as a slide-up sheet — the app's standard surface for opening
 * something without leaving where you were.
 *
 * The Interested bar sits outside the ScrollView so it stays put while the
 * content scrolls under it.
 */
export default function SocietyEventSheet({
  visible, eventId, occurrenceDate, onClose,
}: {
  visible: boolean;
  eventId?: string;
  occurrenceDate?: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { data: event } = useGetSocietyEventQuery(eventId ?? '', { skip: !eventId });

  return (
    <SharedModal visible={visible} onClose={onClose} title={event?.title ?? 'Event'}>
      {eventId ? (
        <>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <EventDetailBody
              eventId={eventId}
              occurrenceDate={occurrenceDate}
              onNavigateAway={onClose}
            />
            <View style={{ height: 16 }} />
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <EventInterestBar eventId={eventId} />
          </View>
        </>
      ) : null}
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  // flexShrink lets the sheet's maxHeight bound the scroll area.
  scroll: { flexShrink: 1 },
  footer: { paddingHorizontal: 16, paddingTop: 12 },
});
