import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { COLOR_GOLD, COLOR_ON_GOLD, COLOR_SHEEN_BUTTER, COLOR_SHEEN_GOLD } from '../../constants/config';

/**
 * A gold sparkle, for a make or model that's in your own garage — MakeTile's
 * `badge`. The gradient runs light, deep, light across the diagonal, so it
 * reads as a sheen rather than a flat gold dot.
 */
export default function GarageMatchBadge() {
  return (
    <LinearGradient
      colors={[COLOR_SHEEN_BUTTER, COLOR_SHEEN_GOLD, COLOR_GOLD, COLOR_SHEEN_GOLD]}
      locations={[0, 0.35, 0.7, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.badge}
      accessible
      accessibilityLabel="In your garage"
    >
      <Sparkles size={14} color={COLOR_ON_GOLD} strokeWidth={2.4} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.45)',
  },
});
