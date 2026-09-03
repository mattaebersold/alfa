import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useBrandColor, useBrandTextColor } from '../../hooks/useBrandColor';
import { colors } from '../../constants/colors';

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

const SIZE_STYLES: Record<Size, { py: number; px: number; fontSize: number }> = {
  sm:      { py: 6,  px: 14, fontSize: 13 },
  default: { py: 10, px: 20, fontSize: 15 },
  lg:      { py: 14, px: 28, fontSize: 16 },
  full:    { py: 12, px: 20, fontSize: 15 },
};

export default function Button({
  label, onPress, variant = 'primary', size = 'default', loading = false, disabled = false,
}: ButtonProps) {
  const s = SIZE_STYLES[size];
  // The brand fill, which is gold for pro members and blue for everyone else.
  // Taken from the hook rather than the static palette so the button follows
  // the account rather than being permanently blue.
  const brand = useBrandColor();
  const brandText = useBrandTextColor();

  const getStyles = (): { bg: string; fg: string; border?: string } => {
    switch (variant) {
      case 'primary':     return { bg: '#08DEE3', fg: '#000000' };
      case 'secondary':   return { bg: '#2A2A2A', fg: '#FFFFFF' };
      case 'dark':        return { bg: brand, fg: brandText };
      case 'outline':     return { bg: 'transparent', fg: '#FFFFFF', border: '#FFFFFF' };
      case 'destructive': return { bg: '#FF0000', fg: '#FFFFFF' };
      case 'ghost':       return { bg: 'transparent', fg: '#BBBBBB' };
      case 'link':        return { bg: 'transparent', fg: '#08DEE3' };
    }
  };

  const v = getStyles();
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
          borderColor: isOutline ? (v.border ?? brand) : 'transparent',
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
