import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../../hooks/useColors';

interface EmptyStateProps {
  title?: string;
  message?: string;
}

export default function EmptyState({
  title = 'Nothing here yet',
  message = 'Check back later.',
}: EmptyStateProps) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.fg }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.grey }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  title:     { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  message:   { fontSize: 14, textAlign: 'center' },
});
