import React from 'react';
import { View } from 'react-native';

/**
 * Trailing space for a horizontal ScrollView.
 *
 * Android drops the trailing padding of a scroll view's content container once
 * the content overflows, so the last card ends up flush against the screen edge
 * while iOS honours it. Pairing a leading `paddingLeft` with this spacer gives
 * both platforms the same margins.
 */
export default function RowEndSpacer({ width = 12 }: { width?: number }) {
  return <View style={{ width }} />;
}
