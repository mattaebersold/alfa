import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { MapPinOff } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import { useColors } from '../../hooks/useColors';
import { FONT_INTER } from '../../theme/fonts';
import { COMMON_RADIUS } from '../../constants/config';

/**
 * What a list shows when near me had nothing: a large "No results near you"
 * box, then an "Other results" heading over the list — which by then is every
 * location (see useNearFallback). Better than an empty screen, and better than
 * quietly switching to All, which left people thinking the list was local.
 *
 * Goes at the end of the list's header, right above the items.
 */
export default function NoResultsNear({
  radius,
  heading = 'Other results',
  style,
}: {
  /** How far near me reached, for the line under the title. */
  radius?: number;
  /** null when the screen's own section heading says it ("Other upcoming events"). */
  heading?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View style={style}>
      <View style={[styles.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MapPinOff size={30} color={colors.grey} strokeWidth={2} />
        <Text style={[styles.title, { color: colors.fg }]}>No results near you</Text>
        <Text style={[styles.sub, { color: colors.grey }]}>
          {radius ? `Nothing within ${radius} miles of where you are.` : 'Nothing close to where you are.'}
          {' '}Here’s everything else.
        </Text>
      </View>
      {heading ? <Text style={[styles.heading, { color: colors.fg }]}>{heading}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center', gap: 8,
    paddingVertical: 32, paddingHorizontal: 20,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
    marginHorizontal: 8, marginBottom: 22,
  },
  title: { fontSize: 20, fontFamily: FONT_INTER.bold, textAlign: 'center' },
  sub: { fontSize: 14, lineHeight: 20, fontFamily: FONT_INTER.semibold, textAlign: 'center' },
  // The section heading the screens use ("All Member Cars").
  heading: { fontSize: 17, fontFamily: FONT_INTER.bold, paddingHorizontal: 8, marginBottom: 12 },
});
