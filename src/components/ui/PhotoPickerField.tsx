import React, { useState } from 'react';
import Svg, { Rect } from 'react-native-svg';
import { View, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@ors/kit';
import { Camera, ImagePlus } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { COMMON_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * "Add a photo", as something you can actually see.
 *
 * Every create form had its own version of this and every one of them was a
 * small icon beside a line of grey text — easy to miss entirely, which is why
 * posts kept arriving without pictures. This is the same tap target drawn as a
 * well the width of its container: grey, long-dashed, the camera alone in it —
 * the create post form's look, used everywhere a form or sheet asks for photos.
 *
 * `compact` is the slim bar for once photos are already added, in the same
 * grey long dash. `title` is the button's accessibility name (and the bar's
 * label when compact); `hint` is an optional line under the camera, off by
 * default.
 *
 * The picking itself stays with the caller: each form differs on how many
 * photos, whether video is allowed, and what to do with the result. This is
 * only the way in.
 */
export default function PhotoPickerField({
  onPress,
  title = 'Add Photos',
  hint = '',
  /** A slim bar instead of the full well — for when photos are already added. */
  compact = false,
  style,
}: {
  onPress: () => void;
  title?: string;
  /** A line under the camera. Empty (the default) for none — the camera alone. */
  hint?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const tint = colors.grey;

  if (compact) {
    return (
      <TouchableOpacity
        // Transparent, like the full well — the dashed outline is the shape.
        style={[styles.compact, style]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <DashedOutline color={tint} />
        <ImagePlus size={17} color={tint} />
        <Text style={[styles.compactText, { color: tint }]}>{title}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      // Transparent: the dashed outline already draws the well, and a filled one
      // read as a card sitting on the form rather than a gap in it.
      style={[styles.well, style]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint || undefined}
    >
      <DashedOutline color={tint} />
      {/* Outlined, not filled — the camera is the thing to see. */}
      <View style={[styles.icon, { borderColor: tint }, !hint && styles.iconAlone]}>
        <Camera size={22} color={tint} />
      </View>
      {/* No title: the camera already says what this is, and the label would
          repeat the button's own accessibility name. */}
      {hint ? <Text style={[styles.hint, { color: tint }]}>{hint}</Text> : null}
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
    // The full width of whatever it sits in — callers set only their own
    // outer margins.
    alignSelf: 'stretch',
    marginTop: 18,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 38, paddingHorizontal: 28,
    borderRadius: COMMON_RADIUS,
    gap: 4,
  },
  icon: {
    // Square-with-a-corner, like every other button in the app.
    width: 46, height: 46, borderRadius: COMMON_RADIUS, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 22,
  },
  // With no hint under it, nothing to leave room for.
  iconAlone: { marginBottom: 0 },
  hint:  { fontSize: 11, fontFamily: FONT_INTER.semibold, lineHeight: 15, textAlign: 'center' },

  compact: {
    alignSelf: 'stretch',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: COMMON_RADIUS,
  },
  compactText: { fontSize: 14, fontFamily: FONT_INTER.semibold },
});
