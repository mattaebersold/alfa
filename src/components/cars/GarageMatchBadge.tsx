import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { COLOR_ON_GOLD, COLOR_SHEEN_GOLD } from '../../constants/config';

/**
 * A gold checkmark, for a make or model that's in your own garage — MakeTile's
 * `badge`. A flat gold dot: no sheen across it.
 */
export default function GarageMatchBadge() {
  return (
    <View style={styles.badge} accessible accessibilityLabel="In your garage">
      <Check size={11} color={COLOR_ON_GOLD} strokeWidth={3.2} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLOR_SHEEN_GOLD,
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.45)',
  },
});
