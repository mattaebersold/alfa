import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  title = 'Nothing here yet',
  message = 'Check back later.',
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.fg }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.grey }]}>{message}</Text>
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
  title:     { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  message:   { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  btn:       {
    backgroundColor: colors.primaryAlt2, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 999,
  },
  btnText:   { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
