import React, { useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet, type Insets, type StyleProp, type ViewStyle,
} from 'react-native';
import { Text } from '@ors/kit';
import { Filter } from 'lucide-react-native';
import SummaryModal, { SummaryTouchable, type SummaryOrigin } from './SummaryModal';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { COMMON_RADIUS, PILL_RADIUS, COLOR_BLACK } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * Reach for the panel's chips — half the 8pt gap between neighbours, so a
 * near-miss still lands without two chips' targets overlapping.
 */
export const FILTER_HIT_SLOP: Insets = { top: 4, bottom: 4, left: 4, right: 4 };

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
 * says what's applied; tapping it opens the options in a panel.
 *
 * Filters combine — a region *and* a type — so a tap only marks a chip, and
 * nothing changes until Apply. That also means trying a combination doesn't
 * refetch the screen behind you on every chip.
 *
 * Shared so that groups, members and cars ask "where" the same way events do.
 * The screen owns what the filters *are*: it hands over the applied value, the
 * pills that describe it, and the panel's sections as a function of a draft.
 * This owns the rest — the row, the panel, and the draft that every open
 * starts from the applied value and every close without Apply throws away.
 *
 * `T` is whatever the screen's filters add up to — one key, or an object of
 * several. Treat it as immutable and replace it through `setDraft`.
 */
export default function FilterSummaryRow<T>({
  value,
  onApply,
  pills,
  children,
  label = 'Filter',
  accessibilityLabel,
  style,
  compact = false,
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
  /**
   * Just what's applied, as a small pill in the brand colour — "Near me ·
   * Cars & Coffee" — for beside a search field, where the full row would cost
   * too much room. Same panel behind it. The kit's FilterSummaryRow has the
   * same, for the photography map.
   */
  compact?: boolean;
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
      {compact ? (
        <SummaryTouchable
          style={[styles.compact, { backgroundColor: brand, borderColor: brand }, style]}
          onPress={open}
          activeOpacity={0.8}
          accessibilityLabel={accessibilityLabel ?? `${label}: ${pills.map((p) => p.label).join(', ')}`}
        >
          {/* The leading pill's icon — near me's pin — before the words. */}
          {pills[0]?.icon}
          <Text style={styles.compactText} numberOfLines={1}>
            {pills.map((p) => p.label).join(' · ') || label}
          </Text>
        </SummaryTouchable>
      ) : (
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
      )}

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
 * One section of single choices, as chips that wrap onto as many lines as they
 * need.
 *
 * Wrapped rather than scrolled sideways, and 44pt tall: a single line of small
 * chips kept the panel short, hid options past the edge, and made every tap a
 * near-miss. See LocationFilterRow, which sets the size these match.
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
      <View style={styles.chipRow}>
        {options.map((opt) => {
          const active = selected === opt.key;
          const fill = opt.color ?? brand;
          return (
            <TouchableOpacity
              key={opt.key ?? '__all'}
              style={[
                styles.chip,
                styles.choiceChip,
                { borderColor: colors.border },
                active && { backgroundColor: fill, borderColor: fill },
              ]}
              onPress={() => onSelect(opt.key)}
              hitSlop={FILTER_HIT_SLOP}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.choiceText, { color: active ? COLOR_BLACK : colors.fg }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginTop: 4, marginBottom: 6,
    // 44pt like the chips inside — it's the thing you tap to get to them.
    minHeight: 44, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  rowLabel: { fontSize: 14, fontFamily: FONT_INTER.semibold },
  // Sized to its words, capped so a long choice can't squeeze the search
  // beside it down to nothing. A pill, like the search.
  compact: {
    height: 38, maxWidth: 190, paddingHorizontal: 16,
    flexDirection: 'row', gap: 5,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: PILL_RADIUS, borderWidth: 1,
  },
  compactText: { flexShrink: 1, fontSize: 14, fontFamily: FONT_INTER.semibold, color: COLOR_BLACK },
  // Takes the rest of the row and gives way first — the chips truncate before
  // the label does.
  selected: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 6, overflow: 'hidden' },
  selectedChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 1 },
  onFill: { color: COLOR_BLACK, flexShrink: 1 },

  body: { paddingTop: 16, paddingBottom: 8 },
  label: {
    fontSize: 11, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.6, textTransform: 'uppercase',
    paddingHorizontal: 12, marginBottom: 6, marginTop: 4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, marginBottom: 12 },
  // Shared by the row's summary pills and the panel's choices; the panel's are
  // made tall enough to hit by `choiceChip`, the row's stay compact.
  chip:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: PILL_RADIUS, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: FONT_INTER.bold },
  choiceChip: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 0, justifyContent: 'center' },
  choiceText: { fontSize: 14, fontFamily: FONT_INTER.bold },
});
