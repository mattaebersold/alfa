import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import { ROUTE_CONDITIONS, conditionLabel } from '../../constants/routeConditions';
import type { RouteCondition } from '../../types/api';
import { PILL_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * Pick what a drive was like — any number of chips. Tapping one toggles it.
 * Used when saving a route and when logging your own drive of one.
 */
export function ConditionPicker({ value, onChange }: {
  value: RouteCondition[];
  onChange: (next: RouteCondition[]) => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const onBrand = contrastText(brand);

  const toggle = (key: RouteCondition) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  return (
    <View style={styles.wrap}>
      {ROUTE_CONDITIONS.map(({ key, label }) => {
        const active = value.includes(key);
        return (
          <TouchableOpacity
            key={key}
            style={[
              styles.chip,
              { borderColor: colors.border },
              active && { backgroundColor: brand, borderColor: brand },
            ]}
            onPress={() => toggle(key)}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
          >
            <Text style={[styles.chipText, { color: active ? onBrand : colors.fg }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** A drive's conditions, read-only, as small quiet pills. Nothing when empty. */
export function ConditionTags({ conditions, style }: { conditions?: string[] | null; style?: any }) {
  const colors = useColors();
  const labels = (conditions ?? []).map(conditionLabel).filter(Boolean) as string[];
  if (!labels.length) return null;
  return (
    <View style={[styles.wrap, styles.tagWrap, style]}>
      {labels.map((label) => (
        <View key={label} style={[styles.tag, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.tagText, { color: colors.grey }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:     { paddingHorizontal: 14, height: 38, borderRadius: PILL_RADIUS, borderWidth: 1.5, justifyContent: 'center' },
  chipText: { fontSize: 13, fontFamily: FONT_INTER.bold },

  tagWrap: { gap: 6 },
  tag:     { paddingHorizontal: 9, paddingVertical: 3, borderRadius: PILL_RADIUS, borderWidth: 1 },
  tagText: { fontSize: 11.5, fontFamily: FONT_INTER.semibold },
});
