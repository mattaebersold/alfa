import React from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '../theme/Text';
import { useBrandColor, useBrandTextColor } from '../theme/useColors';
import Shimmer from './Shimmer';
import { FONT_INTER } from '../theme/fonts';

type Variant = 'brand' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'success';
type Size = 'sm' | 'default' | 'lg' | 'full';

const SIZE_STYLES: Record<Size, { py: number; px: number; fontSize: number }> = {
  sm:      { py: 6,  px: 14, fontSize: 13 },
  default: { py: 10, px: 20, fontSize: 15 },
  lg:      { py: 14, px: 28, fontSize: 16 },
  full:    { py: 13, px: 20, fontSize: 15 },
};

/**
 * alfa's pill button. `brand` is the blue-or-gold fill under alfa's static oil
 * film (alfa's `dark` variant, which was already the brand colour — the name
 * here says what it is). No sweeping band of light: on a button it read as
 * the button flickering, not as something to press.
 */
export default function Button({
  label, onPress, variant = 'brand', size = 'default', loading = false, disabled = false,
  icon, style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const s = SIZE_STYLES[size];
  const brand = useBrandColor();
  const brandText = useBrandTextColor();

  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    brand:       { bg: brand, fg: brandText },
    success:     { bg: '#2FA84F', fg: '#FFFFFF' },
    secondary:   { bg: '#2A2A2A', fg: '#FFFFFF' },
    outline:     { bg: 'transparent', fg: '#FFFFFF', border: 'rgba(255,255,255,0.6)' },
    destructive: { bg: '#D00000', fg: '#FFFFFF' },
    ghost:       { bg: 'transparent', fg: '#BBBBBB' },
  };
  const v = palette[variant];

  const content = loading ? (
    <ActivityIndicator size="small" color={v.fg} />
  ) : (
    <View style={styles.inner}>
      {icon}
      <Text style={[styles.label, { color: v.fg, fontSize: s.fontSize }]}>{label}</Text>
    </View>
  );

  const pad = { paddingVertical: s.py, paddingHorizontal: s.px };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[size === 'full' && styles.full, { opacity: disabled ? 0.5 : 1 }, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {variant === 'brand' || variant === 'success' ? (
        <Shimmer radius={999} color={v.bg} sheen={variant === 'brand'} sweep={false} style={[styles.base, pad]}>
          {content}
        </Shimmer>
      ) : (
        <View
          style={[
            styles.base, pad,
            { backgroundColor: v.bg, borderWidth: v.border ? 1.5 : 0, borderColor: v.border ?? 'transparent' },
          ]}
        >
          {content}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  full: { width: '100%' },
  base: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontWeight: '700', textAlign: 'center' },
});
