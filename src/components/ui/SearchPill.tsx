import React from 'react';
import { View, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle, type TextInputProps } from 'react-native';
import { TextInput } from '@ors/kit';
import { Search, X } from 'lucide-react-native';
import { COMPACT_FILTER_HEIGHT } from './FilterSummaryRow';
import { useColors } from '../../hooks/useColors';
import { PILL_RADIUS, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * The compact filter pill's edge (FilterSummaryRow's `pill`), so the search
 * and the filter beside it read as a pair.
 */
export const SEARCH_PILL_BORDER = '#3C3C3C';

/**
 * The search field that sits beside a filter pill — Cars, Members, Groups,
 * Routes, the marketplace, events.
 *
 * Drawn as the filter pill is: a pill of the same height, on the same fill,
 * edged in the same grey, its words in the same white and weight, and a
 * search glyph as heavy as the pill's own icon. Each screen used to build its
 * own from the form field's squarer box, and the pair never quite matched.
 *
 * `onClear` adds the ✕ once something's typed.
 */
export default function SearchPill({ value, onChangeText, onClear, style, ...input }: Omit<TextInputProps, 'style'> & {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  /** The pill — a flex share in its row, say. */
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View style={[styles.pill, { backgroundColor: colors.inputBg }, style]}>
      <Search size={16} color={COLOR_WHITE} strokeWidth={2.6} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.grey}
        autoCapitalize="none"
        returnKeyType="search"
        {...input}
      />
      {onClear && value.length > 0 && (
        <TouchableOpacity onPress={onClear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
          <X size={15} color={COLOR_WHITE} strokeWidth={2.6} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flex: 1, minWidth: 0, height: COMPACT_FILTER_HEIGHT,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14,
    borderRadius: PILL_RADIUS, borderWidth: 1, borderColor: SEARCH_PILL_BORDER,
  },
  // The filter pill's words: 14, semibold, white.
  input: {
    flex: 1, padding: 0,
    fontSize: 14, fontFamily: FONT_INTER.semibold, color: COLOR_WHITE,
  },
});
