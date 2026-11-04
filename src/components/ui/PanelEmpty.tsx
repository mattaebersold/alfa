import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { useColors } from '../../hooks/useColors';
import { FONT_INTER } from '../../constants/fonts';

/** Tall enough that an empty tab doesn't collapse the panel to a sliver. */
const MIN_HEIGHT = 220;

/**
 * What a summary panel (SummaryModal) shows when a tab or list has nothing in
 * it — "No comments yet", "No cars bookmarked yet". The same for every panel:
 * centred both ways in a block of its own height, larger and quieter than the
 * rows it stands in for.
 */
export default function PanelEmpty({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.text, { color: colors.greyDark }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: MIN_HEIGHT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  text: { fontSize: 17, lineHeight: 24, fontFamily: FONT_INTER.semibold, textAlign: 'center' },
});
