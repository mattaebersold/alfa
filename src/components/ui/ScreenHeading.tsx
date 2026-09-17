import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { PILL_RADIUS } from '../../constants/radius';

interface ScreenHeadingProps {
  title: string;
  /** Optional supporting line under the title. */
  subtitle?: string;
  /** Optional element pinned to the right of the title (filter, action, etc). */
  right?: React.ReactNode;
  /**
   * Item count, shown as a small badge beside the title.
   *
   * Takes a string as well as a number so a count that's against a limit can
   * read "3/5" — see the garage, where a basic membership is capped.
   */
  count?: number | string;
  /**
   * A row of chips beneath the title.
   *
   * For qualifiers that belong *to* the title — a car's year/make/model and its
   * type. Under the title rather than beside it, because a long name and three
   * chips can't share one line without one of them truncating, and the name is
   * never the part worth losing.
   */
  meta?: React.ReactNode;
  /**
   * Tighter padding and a smaller title.
   *
   * Opt-in rather than the default because this component heads eight other
   * screens — marketplace, articles, events, members, groups, podcasts, cars,
   * garage — and they're all sized against each other. A car's page carries
   * more in its heading than any of them, so it's the one that needs the room.
   */
  dense?: boolean;
  /**
   * A smaller, semibold title, for a heading that shares its row with the
   * screen's action — see HeadingActionButton. At full size the title and a
   * button beside it fight for the line.
   */
  inline?: boolean;
}

/**
 * Section title shown at the top of a main list screen, below the header
 * buttons and above the listing itself.
 */
export default function ScreenHeading({ title, subtitle, right, count, meta, dense, inline }: ScreenHeadingProps) {
  const c = useColors();

  return (
    <View style={[styles.wrap, dense && styles.wrapDense]}>
      <View style={styles.row}>
        <View style={styles.titleGroup}>
          <Text style={[styles.title, dense && styles.titleDense, inline && styles.titleInline, { color: c.fg }]} numberOfLines={1}>{title}</Text>
          {count !== undefined && (
            <View style={[styles.countBadge, { backgroundColor: c.segment }]}>
              <Text style={[styles.countText, { color: c.fg }]}>{count}</Text>
            </View>
          )}
        </View>
        {right}
      </View>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: c.grey }]}>{subtitle}</Text>
      ) : null}
      {meta ? <View style={styles.metaRow}>{meta}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:  { paddingHorizontal: 0, paddingTop: 12, paddingBottom: 10 },
  wrapDense: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  row:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  title:      { fontSize: 30, fontWeight: '800', letterSpacing: -0.6, flexShrink: 1 },
  titleDense: { fontSize: 25, letterSpacing: -0.4 },
  titleInline: { fontSize: 24, fontWeight: '600', letterSpacing: -0.3 },
  countBadge: {
    minWidth: 28, height: 28, borderRadius: PILL_RADIUS,
    paddingHorizontal: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  countText:  { fontSize: 13, fontWeight: '800' },
  // Two groups pushed to opposite ends. Callers supply them; this only decides
  // that the row has ends rather than being one run of chips.
  metaRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 8, marginTop: 7,
  },
  subtitle: { fontSize: 13, marginTop: 2 },
});
