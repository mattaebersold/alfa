import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle,
} from 'react-native';
import { Filter } from 'lucide-react-native';
import SummaryModal, { SummaryTouchable, type SummaryOrigin } from './SummaryModal';
import RowEndSpacer from './RowEndSpacer';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';

/** One applied choice, as the row shows it. */
export interface FilterPill {
  key: string;
  label: string;
  /** Fill. The account's brand colour when omitted. */
  color?: string;
  /** Sits before the label — near me's arrow, say. Draw it in black. */
  icon?: React.ReactNode;
}

/**
 * A screen's filters, folded into one row.
 *
 * Started life as the Events screen's own — chip rows took a third of the
 * screen above the list they filter, and most visits never touch them. The row
 * says what's applied; tapping it opens the options in a panel, and nothing
 * changes until Apply, so trying a combination doesn't refetch the screen
 * behind you on every chip.
 *
 * Shared so that groups, members and cars ask "where" the same way events do.
 * The screen owns what the filters *are*: it hands over the applied value, the
 * pills that describe it, and the panel's sections as a function of a draft.
 * This owns the rest — the row, the panel, and the draft that every open
 * starts from the applied value and every close without Apply throws away.
 *
 * `T` is whatever the screen's filters add up to — one key, or an object of
 * several. It is copied, not cloned, so treat it as immutable and replace it
 * through `setDraft` rather than editing it in place.
 */
export default function FilterSummaryRow<T>({
  value,
  onApply,
  pills,
  children,
  label = 'Filter',
  accessibilityLabel,
  style,
}: {
  /** What's applied now. The draft is reset to this on every open. */
  value: T;
  /** The draft, when Apply is pressed. Runs once the panel has closed. */
  onApply: (draft: T) => void;
  /** What the row shows as applied — describes `value`, not the draft. */
  pills: FilterPill[];
  /** The panel's sections, drawn from the draft. */
  children: (draft: T, setDraft: React.Dispatch<React.SetStateAction<T>>) => React.ReactNode;
  label?: string;
  /** Defaults to the label and the pills, read out in order. */
  accessibilityLabel?: string;
  /** For a screen whose gutter isn't 12. */
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const brand = useBrandColor();

  // Undefined while closed; the rect it grows from while open.
  const [origin, setOrigin] = useState<SummaryOrigin | null | undefined>(undefined);
  const [draft, setDraft] = useState<T>(value);

  const open = (from: SummaryOrigin | null) => {
    // Every open starts from what's applied. Closing without Apply discards.
    setDraft(value);
    setOrigin(from);
  };

  return (
    <>
      <SummaryTouchable
        style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }, style]}
        onPress={open}
        activeOpacity={0.8}
        accessibilityLabel={accessibilityLabel ?? `${label}: ${pills.map((p) => p.label).join(', ')}`}
      >
        <Filter size={15} color={colors.fg} strokeWidth={2.4} />
        <Text style={[styles.rowLabel, { color: colors.fg }]}>{label}</Text>
        {/* The same pills the panel shows as selected, so the row reads as
            those choices carried out of the panel. */}
        <View style={styles.selected}>
          {pills.map((pill) => (
            <View
              key={pill.key}
              style={[
                styles.chip,
                styles.selectedChip,
                { backgroundColor: pill.color ?? brand, borderColor: pill.color ?? brand },
              ]}
            >
              {pill.icon}
              <Text style={[styles.chipText, styles.onFill]} numberOfLines={1}>{pill.label}</Text>
            </View>
          ))}
        </View>
      </SummaryTouchable>

      <SummaryModal
        visible={origin !== undefined}
        onClose={() => setOrigin(undefined)}
        origin={origin}
        actionLabel="Apply"
        onAction={() => onApply(draft)}
      >
        <View style={styles.body}>{children(draft, setDraft)}</View>
      </SummaryModal>
    </>
  );
}

/** A section's heading inside the panel — the same one LocationFilterRow uses. */
export function FilterLabel({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.label, { color: colors.grey }]}>{children}</Text>;
}

/**
 * One section of single choices, as a sideways-scrolling row of chips.
 *
 * `null` is a key like any other — it's how "All" is usually spelled. What a
 * tap on the chip already chosen does is the screen's call, so `onSelect` is
 * handed the key either way.
 */
export function FilterChoiceRow<K extends string | null>({
  label,
  options,
  selected,
  onSelect,
}: {
  label?: string;
  options: { key: K; label: string; color?: string }[];
  selected: K;
  onSelect: (key: K) => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();

  return (
    <>
      {label ? <FilterLabel>{label}</FilterLabel> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {options.map((opt) => {
          const active = selected === opt.key;
          const fill = opt.color ?? brand;
          return (
            <TouchableOpacity
              key={opt.key ?? '__all'}
              style={[
                styles.chip,
                { borderColor: colors.border },
                active && { backgroundColor: fill, borderColor: fill },
              ]}
              onPress={() => onSelect(opt.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, { color: active ? '#000000' : colors.fg }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
        <RowEndSpacer />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginTop: 4, marginBottom: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  rowLabel: { fontSize: 14, fontWeight: '600' },
  // Takes the rest of the row and gives way first — the chips truncate before
  // the label does.
  selected: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 6, overflow: 'hidden' },
  selectedChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 1 },
  onFill: { color: '#000000', flexShrink: 1 },

  body: { paddingTop: 16, paddingBottom: 8 },
  label: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase',
    paddingHorizontal: 12, marginBottom: 6, marginTop: 4,
  },
  chipRow: { paddingLeft: 12, gap: 8, paddingBottom: 4 },
  chip:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: PILL_RADIUS, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '700' },
});
