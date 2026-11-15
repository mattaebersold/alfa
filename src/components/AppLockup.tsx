import React from 'react';
import { View, StyleSheet, type ImageSourcePropType } from 'react-native';
import { Text } from '../theme/Text';
import { Image } from 'expo-image';
import { FONT_INTER } from '../theme/fonts';

/** The wheel's own off-white, sampled from alfa's logo.png — the colon and glyph wear it too. */
const CREAM = '#F7F1D9';

type Icon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/**
 * An app's mark as a title: Open Road Society's wheel, a colon, and what this
 * app is about — wheel : camera, wheel : eye. Read as "ORS: photo", so the
 * family resemblance is the first thing in the header rather than a name.
 */
export default function AppLockup({ logo, Icon, label, size = 32 }: {
  /** alfa's wheel — each app ships it as assets/logo.png. */
  logo: ImageSourcePropType;
  Icon: Icon;
  /** Spoken in place of the picture, e.g. the app's name. */
  label: string;
  size?: number;
}) {
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel={label}>
      <Image source={logo} style={{ width: size, height: size }} contentFit="contain" />
      <Text style={[styles.colon, { fontSize: size * 0.85, lineHeight: size }]}>:</Text>
      <Icon size={size * 0.9} color={CREAM} strokeWidth={2.2} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Nudged up a touch: a colon sits on the baseline, and centred on the
  // marks it read as low.
  colon: { color: CREAM, fontWeight: '900', marginTop: -3 },
});
