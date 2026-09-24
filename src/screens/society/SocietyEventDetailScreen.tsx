import React, { useRef } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { FormScrollView } from '@ors/kit';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import { EventDetailBody, EventInterestBar } from '../../components/society/EventDetailBody';
import { useGetSocietyEventQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { ss } from '../../styles/shared';
import { useRefreshControl } from '../../hooks/useRefreshControl';

/**
 * Full-screen event detail. In-app taps open the slide-up sheet instead; this
 * route stays for deep links, and renders the same body so the two can't drift.
 */
export default function SocietyEventDetailScreen({
  route,
}: {
  route: { params: { eventId: string; occurrenceDate?: string } };
}) {
  const { eventId, occurrenceDate } = route.params;
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const scrollRef = useRef<ScrollView>(null);
  useScrollTopOnBack(scrollRef);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerPad = useHeaderPad();
  // Same cache entry EventDetailBody reads, so refetching here refreshes it.
  const { refetch } = useGetSocietyEventQuery(eventId);
  const refreshControl = useRefreshControl(refetch);

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      {/* A FormScrollView for the comment field at the foot of the event:
          focused, it's scrolled up to sit on the keyboard. */}
      <FormScrollView
        ref={scrollRef as any}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
      >
        <EventDetailBody eventId={eventId} occurrenceDate={occurrenceDate} topInset={headerPad} />
      </FormScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.cream,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <EventInterestBar eventId={eventId} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
