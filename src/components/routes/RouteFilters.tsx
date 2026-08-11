import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import type { RouteSort } from '../../types/api';

/**
 * Filter controls for the Routes list.
 *
 * Ranges are offered as presets rather than sliders: on a phone a two-handle
 * range slider is fiddly to operate and hard to read back, and in practice
 * people look for "a long one" or "a really twisty one", not 43-to-58 miles.
 * Each preset maps directly onto the range parameters the API already accepts.
 */

export interface RouteFilterState {
  sort: RouteSort;
  distance: string;
  curviness: string;
  surface: string;
  technical: string;
}

export const DEFAULT_FILTERS: RouteFilterState = {
  sort: 'recent',
  distance: 'any',
  curviness: 'any',
  surface: 'any',
  technical: 'any',
};

/** Miles. Converted to kilometres when the query is built. */
export const DISTANCE_PRESETS: Record<string, { min?: number; max?: number }> = {
  any:    {},
  short:  { max: 15 },
  medium: { min: 15, max: 60 },
  long:   { min: 60 },
};

/** Lower bounds on the computed 0-100 curviness index. */
export const CURVINESS_PRESETS: Record<string, { min?: number }> = {
  any:       {},
  flowing:   { min: 20 },
  technical: { min: 45 },
  extreme:   { min: 70 },
};

const SORTS: { key: RouteSort; label: string }[] = [
  { key: 'recent', label: 'Newest' },
  { key: 'votes', label: 'Top voted' },
  { key: 'curviness', label: 'Most technical' },
  { key: 'distance', label: 'Longest' },
];

const ROWS: { key: keyof RouteFilterState; label: string; options: { key: string; label: string }[] }[] = [
  {
    key: 'distance',
    label: 'Distance',
    options: [
      { key: 'any', label: 'Any' },
      { key: 'short', label: 'Under 15 mi' },
      { key: 'medium', label: '15–60 mi' },
      { key: 'long', label: '60+ mi' },
    ],
  },
  {
    key: 'curviness',
    label: 'How technical',
    options: [
      { key: 'any', label: 'Any' },
      { key: 'flowing', label: 'Flowing' },
      { key: 'technical', label: 'Technical' },
      { key: 'extreme', label: 'Very technical' },
    ],
  },
  {
    key: 'surface',
    label: 'Surface',
    options: [
      { key: 'any', label: 'Any' },
      { key: 'paved', label: 'Paved' },
      { key: 'mixed', label: 'Mixed' },
      { key: 'dirt', label: 'Dirt' },
    ],
  },
  {
    key: 'technical',
    label: 'Driver rating',
    options: [
      { key: 'any', label: 'Any' },
      { key: '3', label: '3+' },
      { key: '4', label: '4+' },
      { key: '5', label: '5' },
    ],
  },
];

interface RouteFiltersProps {
  value: RouteFilterState;
  onChange: (next: RouteFilterState) => void;
  /**
   * Show the distance / technical / surface rows. Off by default — the Routes
   * screen currently surfaces sort only. The presets and `buildRouteQuery`
   * below still map onto range parameters the API accepts, so turning these
   * back on is a one-prop change rather than a rebuild.
   */
  expanded?: boolean;
}

export default function RouteFilters({ value, onChange, expanded = false }: RouteFiltersProps) {
  const colors = useColors();
  const brand = useBrandColor();
  const onBrand = contrastText(brand);

  const Pill = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => (
    <TouchableOpacity
      style={[
        styles.pill,
        { borderColor: colors.border },
        active && { backgroundColor: brand, borderColor: brand },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.pillText, { color: active ? onBrand : colors.fg }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortRow}
      >
        {SORTS.map((s) => (
          <Pill
            key={s.key}
            active={value.sort === s.key}
            label={s.label}
            onPress={() => onChange({ ...value, sort: s.key })}
          />
        ))}
      </ScrollView>

      {expanded && (
        <View style={styles.rows}>
          {ROWS.map((row) => (
            <View key={row.key} style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.grey }]}>{row.label}</Text>
              <View style={styles.rowPills}>
                {row.options.map((opt) => (
                  <Pill
                    key={opt.key}
                    active={value[row.key] === opt.key}
                    label={opt.label}
                    onPress={() => onChange({ ...value, [row.key]: opt.key })}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** How many filters are active, for the "Filters (2)" badge. */
export function activeFilterCount(f: RouteFilterState): number {
  return [f.distance, f.curviness, f.surface, f.technical].filter((v) => v !== 'any').length;
}

/** Turns the UI state into the query the API expects. */
export function buildRouteQuery(f: RouteFilterState) {
  const distance = DISTANCE_PRESETS[f.distance] ?? {};
  const curviness = CURVINESS_PRESETS[f.curviness] ?? {};
  const MILES_TO_KM = 1.609344;

  return {
    sort: f.sort,
    limit: 20,
    // The API compares against metres after multiplying by 1000, so it wants km.
    ...(distance.min !== undefined ? { min_distance: distance.min * MILES_TO_KM } : {}),
    ...(distance.max !== undefined ? { max_distance: distance.max * MILES_TO_KM } : {}),
    ...(curviness.min !== undefined ? { min_curviness: curviness.min } : {}),
    ...(f.surface !== 'any' ? { surface: f.surface } : {}),
    ...(f.technical !== 'any' ? { min_technical: parseInt(f.technical, 10) } : {}),
  };
}

const styles = StyleSheet.create({
  root:    { gap: 10 },
  sortRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14 },

  rows:     { paddingHorizontal: 14, gap: 12 },
  row:      { gap: 6 },
  rowLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  rowPills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

  pill:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, borderWidth: 1.5 },
  pillText: { fontSize: 13, fontWeight: '700' },
});
