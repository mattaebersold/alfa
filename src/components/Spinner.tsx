import React from 'react';
import { ActivityIndicator, View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../theme/Text';
import { useColors, useBrandColor } from '../theme/useColors';
import { FONT_INTER } from '../theme/fonts'

export function Spinner({ size = 'large', color, fullScreen = false }: {
  size?: 'small' | 'large';
  color?: string;
  fullScreen?: boolean;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  if (fullScreen) {
    return (
      <View style={[styles.fullScreen, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size={size} color={color ?? brand} />
      </View>
    );
  }
  return <ActivityIndicator size={size} color={color ?? brand} />;
}

/** alfa's empty state: a quiet line of text, and an optional way forward. */
export function EmptyState({ title = 'Nothing here yet', message, actionLabel, onAction }: {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const brand = useBrandColor();
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.8}>
          <Text style={[styles.emptyAction, { color: brand }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontFamily: FONT_INTER.bold, color: 'rgba(255,255,255,0.25)', textAlign: 'center' },
  emptyMessage: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  emptyAction: { fontSize: 14, fontFamily: FONT_INTER.extrabold, marginTop: 16 },
});
