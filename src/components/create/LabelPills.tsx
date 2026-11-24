import React from 'react';
import { View, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import { useColors } from '../../hooks/useColors';
import { contrastText } from '../../hooks/useBrandColor';
import { PILL_RADIUS, COLOR_WHITE, COLOR_BLACK } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

type Option = { key: string; label: string };

/**
 * A post's type or category, as a wrapping row of pills ending in "+ New".
 * Shared by the new-post form and the Edit Post sheet, so the two match.
 *
 * `tone="type"` is the leading row: a size up, the picked one in the accent.
 * `tone="category"` sits under it: the picked one white.
 */
export default function LabelPills({ options, value, onChange, onLongPress, onAdd, addLabel, tone, style }: {
  options: Option[];
  value: string;
  onChange: (key: string) => void;
  /** Long-press — your own ones open to rename or delete. */
  onLongPress?: (key: string) => void;
  /** Shows "+ New" at the end. */
  onAdd?: () => void;
  addLabel?: string;
  tone: 'type' | 'category';
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const isType = tone === 'type';
  const activeBg = isType ? colors.primaryAlt : COLOR_WHITE;
  const activeFg = isType ? contrastText(colors.primaryAlt) : COLOR_BLACK;

  return (
    <View style={[styles.row, style]}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <TouchableOpacity
            key={o.key}
            style={[
              styles.pill, isType && styles.typePill,
              { borderColor: colors.border, backgroundColor: colors.card },
              on && { backgroundColor: activeBg, borderColor: activeBg },
            ]}
            onPress={() => onChange(o.key)}
            onLongPress={onLongPress ? () => onLongPress(o.key) : undefined}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.text, isType && styles.typeText, { color: on ? activeFg : colors.grey }]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
      {onAdd ? (
        <TouchableOpacity
          style={[styles.pill, isType && styles.typePill, styles.add]}
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
        >
          {/* Just the plus — its accessibility label says what it adds. An
              invisible letter keeps the pill the same height as its row's. */}
          <Plus size={isType ? 17 : 15} color={colors.grey} strokeWidth={2.4} />
          <Text style={[styles.text, isType && styles.typeText, styles.strut]}>{' '}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill:     { paddingHorizontal: 12, paddingVertical: 7, borderRadius: PILL_RADIUS, borderWidth: 1 },
  // The type row leads: a size up from the categories under it.
  typePill: { paddingHorizontal: 15, paddingVertical: 9 },
  text:     { fontSize: 13, fontFamily: FONT_INTER.semibold },
  typeText: { fontSize: 15 },
  // Zero-width: holds the line height so the plus pill matches the others.
  strut:    { width: 0 },
  // "+ New": a pill's size, dashed, unfilled — its edge brighter than the
  // options' so it reads as something to tap.
  add:      { flexDirection: 'row', alignItems: 'center', gap: 0, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.5)' },
});
