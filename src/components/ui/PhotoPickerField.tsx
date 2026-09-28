import React, { useState } from 'react';
import Svg, { Rect } from 'react-native-svg';
import { View, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@ors/kit';
import { Camera, ImagePlus } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { COMMON_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * "Add a photo", as something you can actually see.
 *
 * Every create form had its own version of this and every one of them was a
 * small icon beside a line of grey text — easy to miss entirely, which is why
 * posts kept arriving without pictures. This is the same tap target drawn as a
 * dashed well the width of the form, in the brand colour, saying what it does.
 *
 * The picking itself stays with the caller: each form differs on how many
 * photos, whether video is allowed, and what to do with the result. This is
 * only the way in.
 */
export default function PhotoPickerField({
  onPress,
  title = 'Add Photos',
  hint = 'Take one now or\nchoose from your library',
  /** A slim bar instead of the full well — for when photos are already added. */
  compact = false,
  muted = false,
  style,
}: {
  onPress: () => void;
  title?: string;
  /** The line under the camera. Empty for none — the camera alone. */
  hint?: string;
  compact?: boolean;
  /**
   * Grey, with long dashes, instead of the brand colour and short ones — for a form where
   * the photo well is one quiet option among several rather than the point
   * (the create post form).
   */
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const brandColor = useBrandColor();
  const brand = muted ? colors.grey : brandColor;
  // Muted draws its own outline (DashedOutline), so no border of its own.
  const lineStyle = muted ? styles.noBorder : null;
  const outline = muted ? <DashedOutline color={brand} /> : null;

  if (compact) {
    return (
      <TouchableOpacity
        // Transparent, like the full well — the dashed border is the shape.
        style={[styles.compact, { borderColor: brand }, lineStyle, style]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        {outline}
        <ImagePlus size={17} color={brand} />
        <Text style={[styles.compactText, { color: brand }]}>{title}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      // Transparent: the dashed border already draws the well, and a filled one
      // read as a card sitting on the form rather than a gap in it.
      style={[styles.well, { borderColor: brand }, lineStyle, style]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint || undefined}
    >
      {outline}
      {/* Outlined, not filled — the camera is the thing to see, and it carries
          the brand colour itself. */}
      <View style={[styles.icon, { borderColor: brand }, !hint && styles.iconAlone]}>
        <Camera size={22} color={brand} />
      </View>
      {/* No title: the camera and the hint below already say what this is, and
          the label repeated the button's own accessibility name. */}
      {hint ? <Text style={[styles.hint, { color: colors.grey }]}>{hint}</Text> : null}
    </TouchableOpacity>
  );
}

/** Dash and gap, in points — longer than a native dashed border's. */
const DASH = [10, 6];
const STROKE = 1.5;

/**
 * A long-dashed outline, drawn over the box it's in.
 *
 * A native `borderStyle: 'dashed'` can't be told how long its dashes are, and
 * they come out short enough to read as dots. This is the same rounded
 * rectangle as an SVG stroke, sized to its box once it has laid out.
 */
function DashedOutline({ color }: { color: string }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 && (
        <Svg width={size.w} height={size.h}>
          <Rect
            x={STROKE / 2}
            y={STROKE / 2}
            width={size.w - STROKE}
            height={size.h - STROKE}
            rx={COMMON_RADIUS}
            ry={COMMON_RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeDasharray={DASH}
          />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  well: {
    // Narrower than the form and centred on it: a full-width dashed box read as
    // a section of the page, where this is one thing to tap.
    alignSelf: 'center', maxWidth: 300,
    marginTop: 18,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 38, paddingHorizontal: 28,
    borderRadius: COMMON_RADIUS,
    // Dashed, so it reads as a place to put something rather than as a button
    // that has already done something.
    borderWidth: 1.5, borderStyle: 'dashed',
    gap: 4,
  },
  icon: {
    // Square-with-a-corner, like every other button in the app — it was the
    // one circle left here, and unfilled on both tiers now.
    width: 46, height: 46, borderRadius: COMMON_RADIUS, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 22,
  },
  // With no hint under it, nothing to leave room for.
  iconAlone: { marginBottom: 0 },
  hint:  { fontSize: 11, fontFamily: FONT_INTER.semibold, lineHeight: 15, textAlign: 'center' },
  noBorder: { borderWidth: 0 },

  compact: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: COMMON_RADIUS, borderWidth: 1.5, borderStyle: 'dashed',
  },
  compactText: { fontSize: 14, fontFamily: FONT_INTER.semibold },
});
