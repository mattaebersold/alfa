import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../../hooks/useColors';

interface ScreenHeadingProps {
  title: string;
  /** Optional supporting line under the title. */
  subtitle?: string;
  /** Optional element pinned to the right of the title (filter, action, etc). */
  right?: React.ReactNode;
  /** Item count, shown as a small circle badge beside the title. */
  count?: number;
}

/**
 * Section title shown at the top of a main list screen, below the header
 * buttons and above the listing itself.
 */
export default function ScreenHeading({ title, subtitle, right, count }: ScreenHeadingProps) {
  const c = useColors();

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.titleGroup}>
          <Text style={[styles.title, { color: c.fg }]} numberOfLines={1}>{title}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:  { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  row:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  title:      { fontSize: 30, fontWeight: '800', letterSpacing: -0.6, flexShrink: 1 },
  countBadge: {
    minWidth: 28, height: 28, borderRadius: 14,
    paddingHorizontal: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  countText:  { fontSize: 13, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
});
