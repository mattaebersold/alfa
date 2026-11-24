import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '../../theme/Text';
import { colors } from '../../constants/colors';
import { FONT_INTER } from '../../constants/fonts';

/**
 * A Pro screen section's heading: its icon, then the title, both in the Pro
 * red. The home shelves' heading size (PostStrip's title), so the Pro
 * sections still read as shelves — just marked as Pro's.
 */
export default function ProSectionTitle({ title, Icon, style }: {
  title: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.row, style]}>
      <Icon size={17} color={colors.pro} strokeWidth={2.4} />
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  title: { flexShrink: 1, fontSize: 17, fontFamily: FONT_INTER.semibold, color: colors.pro },
});
