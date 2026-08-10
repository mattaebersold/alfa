import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import { EventDetailBody, EventInterestBar } from '../../components/society/EventDetailBody';
import { useColors } from '../../hooks/useColors';
import { ss } from '../../styles/shared';

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
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerPad = useHeaderPad();

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
      >
        <EventDetailBody eventId={eventId} occurrenceDate={occurrenceDate} topInset={headerPad} />
      </ScrollView>

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
