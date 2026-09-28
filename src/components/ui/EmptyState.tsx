import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { COMMON_RADIUS, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  title = 'Nothing here yet',
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: COLOR_WHITE, opacity: 0.2 }]}>{title}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.btn} onPress={onAction} activeOpacity={0.8}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  title:     { fontSize: 18, fontFamily: FONT_INTER.bold, marginBottom: 8, textAlign: 'center' },
  message:   { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  btn:       {
    backgroundColor: colors.primaryAlt, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: COMMON_RADIUS,
  },
  btnText:   { color: COLOR_WHITE, opacity: 0.5, fontSize: 14, fontFamily: FONT_INTER.bold },
});
