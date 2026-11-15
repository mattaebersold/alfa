import React from 'react';
import { View, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { Text } from '../../theme/Text';
import { COLOR_GRAY_224 } from '../../constants/config';

/** "911 (996)" → the model, and its generation on its own. */
const GENERATION = /^(.*\S)\s*\(([^()]+)\)$/;

/**
 * A make or model as text, with a model's generation as a small dark pill at
 * the far end rather than in brackets — in the picker, the guess fields and
 * the guesses made.
 */
export default function ModelLabel({ value, style }: { value: string; style?: StyleProp<TextStyle> }) {
  const m = GENERATION.exec(value);
  if (!m) return <Text style={[styles.flex, style]} numberOfLines={1}>{value}</Text>;
  return (
    <View style={styles.label}>
      <Text style={[style, styles.name]} numberOfLines={1}>{m[1]}</Text>
      <View style={styles.gen}>
        <Text style={styles.genText} numberOfLines={1}>{m[2]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  label: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, minWidth: 0 },
  name: { flex: 0, flexShrink: 1 },
  gen: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.45)', flexShrink: 0 },
  genText: { color: COLOR_GRAY_224, fontSize: 10, lineHeight: 12, fontWeight: '700' },
});
