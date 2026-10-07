import React, { useEffect, useRef } from 'react';
import { ScrollView, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@ors/kit';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import { COLOR_GRAY_90, PILL_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * A scrolling row of filter chips: the chosen one filled in the brand
 * colour, the rest outlined in grey on nothing.
 *
 * Distinct from Segmented, which is a filled track with a sliding thumb.
 * That reads as one control with modes; this reads as a set of tags to
 * pick from, which is what a category filter is. It carries no margin of
 * its own — it lines up with whatever gutter its screen gives it.
 */
export default function ChipRow<T extends string>({ options, value, onChange, style }: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const scrollRef = useRef<ScrollView>(null);
  const xs = useRef<Record<string, number>>({});

  // The chosen chip in view, with the one before it peeking.
  useEffect(() => {
    const x = xs.current[value];
    if (x != null) scrollRef.current?.scrollTo({ x: Math.max(0, x - 24), animated: true });
  }, [value]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, style]}
      keyboardShouldPersistTaps="handled"
      accessibilityRole="radiogroup"
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            onLayout={(e) => { xs.current[o.key] = e.nativeEvent.layout.x; }}
            onPress={() => onChange(o.key)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[
              styles.chip,
              active
                ? { backgroundColor: brand, borderColor: brand }
                : { backgroundColor: 'transparent', borderColor: COLOR_GRAY_90 },
            ]}
          >
            <Text style={[styles.label, { color: active ? contrastText(brand) : colors.muted }]} numberOfLines={1}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row:   { flexDirection: 'row', gap: 8 },
  chip:  { paddingVertical: 8, paddingHorizontal: 14, borderRadius: PILL_RADIUS, borderWidth: 1 },
  label: { fontSize: 13, fontFamily: FONT_INTER.medium },
});
