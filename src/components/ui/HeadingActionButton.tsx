import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Plus } from 'lucide-react-native';
import { useBrandColor } from '../../hooks/useBrandColor';
import { COMMON_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

interface HeadingActionButtonProps {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  /** A short count riding inside the button — a basic member's allowance. */
  badge?: string;
  /** A size down — for a crowded head, beside other controls. */
  compact?: boolean;
  /** In place of the brand colour — white, beside a section heading rather than a screen's title. */
  color?: string;
}

/**
 * A screen's one action, sitting in its heading row beside the title.
 *
 * Add Car, New Group, Add new event and New Route used to be full-width filled
 * bars under the title. Beside it, outlined in the brand colour, the action
 * stays the obvious thing to press without a band of colour pushing the
 * content down the screen. Pass it to ScreenHeading's `right` with `inline`.
 */
export default function HeadingActionButton({ label, onPress, accessibilityLabel, badge, compact = false, color }: HeadingActionButtonProps) {
  const brandColor = useBrandColor();
  const brand = color ?? brandColor;

  return (
    <TouchableOpacity
      style={[styles.btn, compact && styles.btnCompact, { borderColor: brand }]}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={compact ? 10 : 6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Plus size={compact ? 12 : 15} color={brand} strokeWidth={2.6} />
      <Text style={[styles.label, compact && styles.labelCompact, { color: brand }]} numberOfLines={1}>{label}</Text>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: `${brand}2E` }]}>
          <Text style={[styles.badgeText, { color: brand }]}>{badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 7,
    borderWidth: 1.5, borderRadius: COMMON_RADIUS,
    flexShrink: 0,
  },
  btnCompact: { gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  label: { fontSize: 13, fontFamily: FONT_INTER.bold, letterSpacing: 0.2 },
  labelCompact: { fontSize: 11.5 },
  badge: {
    marginLeft: 2,
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: COMMON_RADIUS,
  },
  badgeText: { fontSize: 11, fontFamily: FONT_INTER.bold, fontVariant: ['tabular-nums'] },
});
