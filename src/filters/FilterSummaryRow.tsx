import React, { useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet, type Insets, type StyleProp, type ViewStyle,
} from 'react-native';
import { Text } from '../theme/Text';
import { Filter } from 'lucide-react-native';
import SummaryModal, { SummaryTouchable, type SummaryOrigin } from '../components/SummaryModal';
import { useColors, useBrandColor } from '../theme/useColors';
import { COMMON_RADIUS, PILL_RADIUS } from '../theme/radius';
import { FONT_INTER } from '../theme/fonts';

/** Ink on a filled chip. */
const ON_FILL = '#000000';

/**
 * Reach for the panel's chips — half the 8pt gap between neighbours, so a
 * near-miss still lands without two chips' targets overlapping.
 */
export const FILTER_HIT_SLOP: Insets = { top: 4, bottom: 4, left: 4, right: 4 };

/**
 * A filter chip's height — location, category, type. 36 to look at, and with
 * FILTER_HIT_SLOP above and below still a 44pt target.
 */
export const FILTER_CHIP_HEIGHT = 36;

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
  compactVariant = 'button',
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
   * Just what's applied, as a small button — "Near me", or "Near me · Park"
   * — for somewhere the full row would cost too much room. Same panel behind
   * it.
   */
  compact?: boolean;
  /**
   * The compact form's shape. `button` (the default) is a squarer 44pt button
   * that stacks two choices on two lines — for floating over a map. `pill` is
   * a 38pt pill with the leading pill's icon and every choice on one line —
   * for beside a search field, as alfa's lists have it. `icon` is a 38pt
   * circle with just the filter icon — the choices are read out, not shown.
   */
  compactVariant?: 'button' | 'pill' | 'icon';
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

  const a11y = accessibilityLabel ?? `${label}: ${pills.map((p) => p.label).join(', ')}`;

  return (
    <>
      {compact ? (
        <SummaryTouchable
          // Exactly the search field beside it — its fill and its edge. The brand fill was too
          // loud for a control that sits on every browse screen. The chips in
          // the panel keep the brand colour for what's chosen.
          style={[
            compactVariant === 'pill' ? styles.compactPill : compactVariant === 'icon' ? styles.compactIcon : styles.iconBtn,
            { backgroundColor: colors.inputBg, borderColor: colors.borderStrong }, style,
          ]}
          onPress={open}
          activeOpacity={0.8}
          accessibilityLabel={a11y}
        >
          {compactVariant === 'icon' ? (
            <Filter size={16} color={colors.fg} strokeWidth={2.4} />
          ) : compactVariant === 'pill' ? (
            <>
              {/* The leading pill's icon — near me's pin — before the words,
                  in the button's ink rather than the black it wears on a fill. */}
              {React.isValidElement(pills[0]?.icon)
                ? React.cloneElement(pills[0]!.icon as React.ReactElement<{ color?: string }>, { color: colors.fg })
                : pills[0]?.icon}
              <Text style={[styles.compactPillText, { color: colors.fg }]} numberOfLines={1}>
                {pills.map((p) => p.label).join(' · ') || label}
              </Text>
            </>
          ) : pills.length > 1 ? (
            // The applied choices themselves — the same words the row's pills
            // would show, without the row. Black on the brand fill, as chips
            // are. More than one goes on two smaller lines: where on top, the
            // rest under it, so "Northwest · Scenic" isn't cut to "Northw…".
            <>
              <Text style={[styles.compactText, styles.compactTextStacked, { color: colors.fg }]} numberOfLines={1}>
                {pills[0].label}
              </Text>
              <Text style={[styles.compactText, styles.compactTextStacked, { color: colors.fg }]} numberOfLines={1}>
                {pills.slice(1).map((p) => p.label).join(' · ')}
              </Text>
            </>
          ) : (
            <Text style={[styles.compactText, { color: colors.fg }]} numberOfLines={1}>
              {pills[0]?.label || label}
            </Text>
          )}
        </SummaryTouchable>
      ) : (
      <SummaryTouchable
        style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }, style]}
        onPress={open}
        activeOpacity={0.8}
        accessibilityLabel={a11y}
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
        actionRounded
        onAction={() => onApply(draft)}
      >
        <View style={styles.body}>{children(draft, setDraft)}</View>
      </SummaryModal>
    </>
  );
}

/**
 * A rule between a panel's sections, edge to edge. `last` for the one closing
 * the final section, which sits right on the Apply footer with no gap under it.
 */
export function FilterDivider({ last = false }: { last?: boolean }) {
  const colors = useColors();
  return <View style={[styles.divider, last && styles.dividerLast, { backgroundColor: colors.border }]} />;
}

/** A section's heading inside the panel — the same one LocationFilterRow uses. */
export function FilterLabel({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.label, { color: colors.grey }]}>{children}</Text>;
}

/**
 * One section of single choices, as chips that wrap onto as many lines as they
 * need — every option in view at once, none a sideways swipe away.
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
              <Text style={[styles.choiceText, { color: active ? ON_FILL : colors.fg }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

/**
 * The compact filter pill's height — and the search field's beside it, which
 * reads this so the two can't drift apart.
 */
export const COMPACT_FILTER_HEIGHT = 38;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginTop: 4, marginBottom: 6,
    // 44pt like the chips inside — it's the thing you tap to get to them.
    minHeight: 44, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  rowLabel: { fontSize: 14, fontFamily: FONT_INTER.semibold },
  // Sized to its words, capped so a long type can't push the search beside
  // it down to nothing.
  iconBtn: {
    height: 44, maxWidth: 180, paddingHorizontal: 14,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  compactText: { fontSize: 14, fontFamily: FONT_INTER.bold },
  // Sized to its words, capped so a long choice can't squeeze the search
  // beside it down to nothing. A pill, like the search.
  compactPill: {
    height: COMPACT_FILTER_HEIGHT, maxWidth: 190, paddingHorizontal: 16,
    flexDirection: 'row', gap: 5,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: PILL_RADIUS, borderWidth: 1,
  },
  // Just the icon, in a circle the search field's height.
  compactIcon: {
    width: COMPACT_FILTER_HEIGHT, height: COMPACT_FILTER_HEIGHT, borderRadius: COMPACT_FILTER_HEIGHT / 2,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  compactPillText: { flexShrink: 1, fontSize: 14, fontFamily: FONT_INTER.semibold, color: ON_FILL },
  // Two lines in the same 44pt height.
  compactTextStacked: { fontSize: 11.5, lineHeight: 14 },
  // Takes the rest of the row and gives way first — the chips truncate before
  // the label does.
  selected: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 6, overflow: 'hidden' },
  selectedChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 1 },
  onFill: { color: '#000000', flexShrink: 1 },

  // The Apply footer's own 14 at the top; nothing at the foot, where the
  // footer brings its padding.
  body: { paddingTop: 14, paddingBottom: 0 },
  label: {
    fontSize: 11, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.6, textTransform: 'uppercase',
    paddingHorizontal: 12, marginBottom: 6, marginTop: 4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, marginBottom: 12 },
  // A full point rather than a hairline, so it reads as a rule on the dark panel.
  divider: { height: 1, marginTop: 6, marginBottom: 18 },
  dividerLast: { marginBottom: 0 },
  chip:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: PILL_RADIUS, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: FONT_INTER.bold },
  choiceChip: { minHeight: FILTER_CHIP_HEIGHT, paddingHorizontal: 16, paddingVertical: 0, justifyContent: 'center' },
  choiceText: { fontSize: 14, fontFamily: FONT_INTER.bold },
});
