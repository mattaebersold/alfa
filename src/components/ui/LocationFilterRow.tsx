import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Navigation } from 'lucide-react-native';
import RowEndSpacer from './RowEndSpacer';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { REGIONS } from '../../constants/regions';
import { RADIUS_OPTIONS, type LocationChoice } from '../../hooks/useLocationFilter';
import type { FilterPill } from './FilterSummaryRow';

/**
 * Where to look: near me, everywhere, or one region.
 *
 * The same row on events, members and cars, because it's the same question
 * each time and answering it differently per screen is how three filters end
 * up looking like three features. Near me leads and is the default — the
 * society is a driving club, and what's reachable this weekend is the first
 * thing anyone wants.
 *
 * The radius only appears under near me: a region has a size of its own, and
 * "everywhere" has no middle to measure from.
 */
export default function LocationFilterRow({
  choice,
  onChoose,
  radius,
  onRadius,
  regions,
  note,
}: {
  choice: LocationChoice;
  onChoose: (next: LocationChoice) => void;
  radius: number;
  onRadius: (miles: number) => void;
  /**
   * The regions worth offering, when the screen knows — events list only the
   * ones with something coming up. Otherwise every region is shown.
   */
  regions?: { key: string; label: string }[];
  /** Shown under the row — why near me couldn't be answered, typically. */
  note?: string | null;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const options = [
    { key: 'near', label: 'Near me' },
    { key: 'all', label: 'All' },
    ...(regions ?? REGIONS.map((r) => ({ key: r.key, label: r.label }))),
  ];

  return (
    <>
      <Text style={[styles.label, { color: colors.grey }]}>Location</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {options.map((opt) => {
          const active = choice === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.chip,
                { borderColor: colors.border },
                active && { backgroundColor: brand, borderColor: brand },
              ]}
              onPress={() => onChoose(opt.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              {opt.key === 'near' && <Navigation size={11} color={active ? '#000000' : colors.fg} />}
              <Text style={[styles.chipText, { color: active ? '#000000' : colors.fg }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        <RowEndSpacer />
      </ScrollView>

      {choice === 'near' && (
        <View style={styles.radiusRow}>
          {RADIUS_OPTIONS.map((miles) => {
            const active = radius === miles;
            return (
              <TouchableOpacity
                key={miles}
                style={[
                  styles.radiusChip,
                  { borderColor: colors.border },
                  active && { backgroundColor: colors.segment, borderColor: colors.grey },
                ]}
                onPress={() => onRadius(miles)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.radiusText, { color: active ? colors.fg : colors.grey }]}>
                  {miles} mi
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {note ? <Text style={[styles.note, { color: colors.grey }]}>{note}</Text> : null}
    </>
  );
}

/**
 * The applied location as a filter row's pill — "Near me · 100 mi", "All
 * locations", or the region's name.
 *
 * Here rather than on each screen so the row reads the same on events, members
 * and cars, which is the point of them sharing this row in the first place.
 */
export function locationPill(
  choice: LocationChoice,
  radius: number,
  regions?: { key: string; label: string }[],
): FilterPill {
  const label =
    choice === 'near' ? `Near me · ${radius} mi`
    : choice === 'all' ? 'All locations'
    : (regions?.find((r) => r.key === choice) ?? REGIONS.find((r) => r.key === choice))?.label
      ?? choice;
  return {
    key: 'location',
    label,
    icon: choice === 'near' ? <Navigation size={11} color="#000000" /> : undefined,
  };
}

/** What to say when near me has no zip to measure from. */
export const NO_ZIP_NOTE =
  "Near me uses the zip on your profile, and there isn't one yet — so this is everything. Add a zip in Settings to see what's near you.";

const styles = StyleSheet.create({
  label: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase',
    paddingHorizontal: 12, marginBottom: 6, marginTop: 4,
  },
  row: { paddingLeft: 12, gap: 8, paddingBottom: 4, marginBottom: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '700' },

  radiusRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, marginTop: -2, marginBottom: 10 },
  radiusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  radiusText: { fontSize: 11, fontWeight: '700' },

  note: { fontSize: 12, lineHeight: 17, paddingHorizontal: 12, marginTop: -2, marginBottom: 10 },
});
