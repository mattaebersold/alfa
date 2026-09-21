import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGetUserGarageQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { PILL_RADIUS } from '../../constants/radius';

/**
 * Which garage car a list is for — or none, which is the usual answer.
 *
 * The same chips the marketplace form uses to link a listing to a car, and the
 * same gesture: tap one to choose it, tap it again to let go. No separate
 * "None" chip, because nothing selected already says that.
 *
 * Only the member's own cars are offered. The server attaches a list to a car
 * by id and checks it's theirs; offering anyone else's would be offering a
 * refusal.
 */
export default function ListCarPicker({ value, valueLabel, onChange }: {
  /** The chosen car's `internal_id`, or `''` for a list that stands on its own. */
  value: string;
  /** What to call the chosen car if it isn't among the garage's — see below. */
  valueLabel?: string;
  onChange: (carId: string) => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const { data: garage } = useGetUserGarageQuery();
  const cars = garage?.entries ?? [];
  // A chosen car the garage query doesn't list — one you co-own, which the
  // server accepts a list on but which isn't "yours" to that endpoint, or one
  // since archived. It still gets a chip: a selection you can't see is one you
  // can't clear. Held back until the garage has loaded, so it doesn't flash.
  const orphan = !!value && !!garage && !cars.some((c) => c.internal_id === value);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.muted }]}>Attach to a car</Text>
      <Text style={[styles.hint, { color: colors.grey }]}>
        Optional. A list with a car shows on that car's page instead of your
        profile — "Future inspiration", "5 mods I want to do next year".
      </Text>
      {cars.length === 0 && !orphan ? (
        <Text style={[styles.hint, { color: colors.grey }]}>Nothing in your garage yet.</Text>
      ) : (
        <View style={styles.chips}>
          {orphan ? (
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: brand, borderColor: brand }]}
              onPress={() => onChange('')}
              accessibilityRole="button"
              accessibilityState={{ selected: true }}
            >
              <Text style={[styles.chipText, { color: '#000000' }]} numberOfLines={1}>
                {valueLabel || 'Selected car'}
              </Text>
            </TouchableOpacity>
          ) : null}
          {cars.map((car) => {
            const on = value === car.internal_id;
            return (
              <TouchableOpacity
                key={car.internal_id}
                style={[
                  styles.chip,
                  { borderColor: colors.border, backgroundColor: colors.card },
                  on && { backgroundColor: brand, borderColor: brand },
                ]}
                onPress={() => onChange(on ? '' : car.internal_id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.chipText, { color: on ? '#000000' : colors.fg }]} numberOfLines={1}>
                  {car.title || [car.year, car.make, car.model].filter(Boolean).join(' ') || 'Car'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:  { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  hint:  { fontSize: 12.5, lineHeight: 18, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: PILL_RADIUS, borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
});
