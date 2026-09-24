import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FormScrollView, KEYBOARD_GAP } from '@ors/kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SharedModal from '../ui/SharedModal';
import { EventDetailBody, EventInterestBar } from './EventDetailBody';
import { useGetSocietyEventQuery } from '../../api/apiService';

/** Roughly the Interested bar's height, above the keyboard while typing. */
const INTEREST_BAR_H = 64;

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
          {/* The comment field at the foot of the event is scrolled up onto
              the keyboard — clear of the Interested bar too, which rides up
              with the sheet under it. */}
          <FormScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            bottomOffset={KEYBOARD_GAP + INTEREST_BAR_H}
          >
            <EventDetailBody
              eventId={eventId}
              occurrenceDate={occurrenceDate}
              onNavigateAway={onClose}
            />
            <View style={{ height: 16 }} />
          </FormScrollView>

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
