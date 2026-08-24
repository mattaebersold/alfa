import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Camera, ImagePlus } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';

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
  hint = 'Take one now or choose from your library',
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
        style={[styles.compact, { borderColor: brand, backgroundColor: colors.card }, style]}
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
      style={[styles.well, { borderColor: brand, backgroundColor: colors.card }, style]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint}
    >
      <View style={[styles.icon, { backgroundColor: brand + '22', borderColor: brand }]}>
        <Camera size={22} color={brand} />
      </View>
      <Text style={[styles.title, { color: colors.fg }]}>{title}</Text>
      <Text style={[styles.hint, { color: colors.grey }]}>{hint}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  well: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 22, paddingHorizontal: 16,
    borderRadius: 14,
    // Dashed, so it reads as a place to put something rather than as a button
    // that has already done something.
    borderWidth: 1.5, borderStyle: 'dashed',
    gap: 4,
  },
  icon: {
    width: 46, height: 46, borderRadius: 23, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  title: { fontSize: 15, fontWeight: '800' },
  hint:  { fontSize: 12, textAlign: 'center' },

  compact: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed',
  },
  compactText: { fontSize: 14, fontWeight: '800' },
});
