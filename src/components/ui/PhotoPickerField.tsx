import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Camera, ImagePlus } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { COMMON_RADIUS } from '../../constants/radius';

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
  style,
}: {
  onPress: () => void;
  title?: string;
  hint?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const brand = useBrandColor();

  if (compact) {
    return (
      <TouchableOpacity
        // Transparent, like the full well — the dashed border is the shape.
        style={[styles.compact, { borderColor: brand }, style]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <ImagePlus size={17} color={brand} />
        <Text style={[styles.compactText, { color: brand }]}>{title}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      // Transparent: the dashed border already draws the well, and a filled one
      // read as a card sitting on the form rather than a gap in it.
      style={[styles.well, { borderColor: brand }, style]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint}
    >
      {/* Outlined, not filled — the camera is the thing to see, and it carries
          the brand colour itself. */}
      <View style={[styles.icon, { borderColor: brand }]}>
        <Camera size={22} color={brand} />
      </View>
      {/* No title: the camera and the hint below already say what this is, and
          the label repeated the button's own accessibility name. */}
      <Text style={[styles.hint, { color: colors.grey }]}>{hint}</Text>
    </TouchableOpacity>
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
  hint:  { fontSize: 11, fontWeight: '600', lineHeight: 15, textAlign: 'center' },

  compact: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: COMMON_RADIUS, borderWidth: 1.5, borderStyle: 'dashed',
  },
  compactText: { fontSize: 14, fontWeight: '600' },
});
