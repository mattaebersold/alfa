import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator, StyleSheet,
  StyleProp, ViewStyle, TextStyle,
} from 'react-native';

// The app's accent blue (kept literal so it never picks up the pro/gold remap).
export const SHARED_BLUE = 'rgb(37, 162, 211)';

type LucideIcon = React.ComponentType<{ size?: number; color?: string }>;

interface SharedButtonProps {
  label: string;
  onPress: () => void;
  /** 'blue' (default) = blue fill, black text. 'outline' = transparent w/ border. */
  variant?: 'blue' | 'outline';
  Icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  /** Full-width block button. */
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * Reusable app button. Default look: solid blue with black text.
 * Convert other buttons to this when asked to "use SharedButton".
 */
export default function SharedButton({
  label,
  onPress,
  variant = 'blue',
  Icon,
  disabled,
  loading,
  full,
  style,
  textStyle,
}: SharedButtonProps) {
  const isOutline = variant === 'outline';
  const fg = isOutline ? SHARED_BLUE : '#000000';

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        isOutline
          ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: SHARED_BLUE }
          : { backgroundColor: SHARED_BLUE },
        full && styles.full,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {Icon && <Icon size={16} color={fg} />}
          <Text style={[styles.label, { color: fg }, textStyle]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12,
  },
  full:     { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  label:    { fontSize: 15, fontWeight: '800' },
});
