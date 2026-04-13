import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

type Variant = 'primary' | 'secondary' | 'dark' | 'outline' | 'destructive' | 'ghost' | 'link';
type Size = 'sm' | 'default' | 'lg' | 'full';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
}

const VARIANT_STYLES: Record<Variant, { bg: string; fg: string }> = {
  primary:     { bg: '#08DEE3', fg: '#000000' },
  secondary:   { bg: Colors.secondary, fg: Colors.fg },
  dark:        { bg: Colors.brg, fg: '#FFFFFF' },
  outline:     { bg: 'transparent', fg: Colors.brg },
  destructive: { bg: '#FF0000', fg: '#FFFFFF' },
  ghost:       { bg: 'transparent', fg: Colors.grey },
  link:        { bg: 'transparent', fg: '#08DEE3' },
};

const SIZE_STYLES: Record<Size, { py: number; px: number; fontSize: number }> = {
  sm:      { py: 6,  px: 14, fontSize: 13 },
  default: { py: 10, px: 20, fontSize: 15 },
  lg:      { py: 14, px: 28, fontSize: 16 },
  full:    { py: 12, px: 20, fontSize: 15 },
};

export default function Button({
  label, onPress, variant = 'primary', size = 'default', loading = false, disabled = false,
}: ButtonProps) {
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];
  const isOutline = variant === 'outline';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          paddingVertical: s.py,
          paddingHorizontal: s.px,
          width: size === 'full' ? '100%' : undefined,
          borderWidth: isOutline ? 1.5 : 0,
          borderColor: isOutline ? Colors.brg : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : (
        <Text style={[styles.label, { color: v.fg, fontSize: s.fontSize }]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  label: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
