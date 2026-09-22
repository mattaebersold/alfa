import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ORS_EVENT_COLOR } from '../../constants/eventTypes';
import { contrastText } from '../../hooks/useBrandColor';
import { useColors } from '../../hooks/useColors';
import { PILL_RADIUS } from '../../constants/radius';

/**
 * The badges above an event card's copy: what kind of thing this is, and which
 * category, as pills rather than as a coloured band across the card.
 *
 * The category pill wears the category's own colour — the same hue the
 * calendar dots use — and "Event" sits beside it as a plain pill, so the colour
 * says *which* and the neutral pill says *what*. An ORS-backed event adds the
 * gold "ORS Event". A rally has no category and is always ORS-run, so its one
 * gold pill carries type and backing together.
 */
export default function EventPills({ category, ors }: {
  /** The category's label and colour; absent for a rally. */
  category?: { label: string; color: string } | null;
  /** Backed by ORS — an event's gold badge, or a rally's whole pill. */
  ors?: boolean;
}) {
  const colors = useColors();

  if (!category) {
    return (
      <View style={styles.row}>
        <Pill label="ORS Rally" color={ORS_EVENT_COLOR} />
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Pill label={category.label} color={category.color} shrink />
      <Pill label="Event" color={colors.secondary} textColor={colors.fg} />
      {ors ? <Pill label="ORS Event" color={ORS_EVENT_COLOR} /> : null}
    </View>
  );
}

function Pill({ label, color, textColor, shrink }: {
  label: string;
  color: string;
  textColor?: string;
  /** Let this pill give way first when the row is short of room. */
  shrink?: boolean;
}) {
  return (
    <View style={[styles.pill, shrink && styles.pillShrink, { backgroundColor: color }]}>
      <Text style={[styles.text, { color: textColor ?? contrastText(color) }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: { borderRadius: PILL_RADIUS, paddingHorizontal: 9, paddingVertical: 3 },
  // The category is the longest label ("Cars & Coffee") and the most
  // recognisable by colour alone, so it's the one that truncates.
  pillShrink: { flexShrink: 1 },
  text: { fontSize: 11, fontWeight: '800' },
});
