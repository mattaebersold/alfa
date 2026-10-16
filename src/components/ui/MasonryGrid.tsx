import React, { useState } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Two columns, each card its own height — the Cars page's mosaic, for any
 * list of cards whose pictures aren't one shape.
 *
 * Items alternate left and right rather than being balanced by height: a
 * card's height is only known once its picture loads, and moving a card to the
 * other column after it had appeared would be worse than an uneven foot.
 *
 * Measures a column and hands each card its width, so a card never has to
 * know what it sits in — a panel's border or the host's padding can't push the
 * cards past their columns and close up the gap.
 */
export default function MasonryGrid<T>({ items, keyOf, renderItem, gap = 12, style }: {
  items: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, width: number) => React.ReactNode;
  /** Between the columns, and between cards down each. */
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  /**
   * A column's own width, measured — not worked out from the grid's: the grid's
   * includes whatever padding the host gave it, and cards sized from that ran
   * wider than their column and closed up the gap between the two.
   */
  const [colW, setColW] = useState(0);

  return (
    <View style={[styles.row, { gap }, style]}>
      {[0, 1].map((col) => (
        <View
          key={col}
          style={[styles.column, { gap }]}
          onLayout={col === 0 ? (e) => setColW(Math.floor(e.nativeEvent.layout.width)) : undefined}
        >
          {colW > 0 && items.filter((_, i) => i % 2 === col).map((item) => (
            <React.Fragment key={keyOf(item)}>{renderItem(item, colW)}</React.Fragment>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { flex: 1 },
});
