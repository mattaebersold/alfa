import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '../../hooks/useColors';

/** More than this and it's a list to scroll, not a shortcut. */
const MAX_SUGGESTIONS = 8;

/**
 * A text field that offers what's already known, without insisting on it.
 *
 * Free text either way — you can type a make nobody has entered before — but
 * the ones already in the database are one tap away, which is what stops the
 * same car arriving as "Porsche", "porsche" and "Posrche".
 *
 * The list renders *below* the field in the flow rather than floating over it.
 * An absolutely-positioned dropdown inside a scrolling form gets clipped by
 * whatever it overflows, and fighting that with zIndex is a losing game on
 * Android.
 */
export default function AutocompleteField({
  label,
  value,
  onChangeText,
  onSelect,
  suggestions,
  placeholder,
  autoCapitalize = 'words',
  style,
  inputStyle,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  /** Defaults to `onChangeText`. */
  onSelect?: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
  style?: StyleProp<ViewStyle>;
  inputStyle?: any;
}) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    // Nothing typed yet: offer the head of the list rather than nothing, so
    // the field advertises that there is a list at all.
    const pool = q
      ? suggestions.filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q)
      : suggestions;
    // Anything starting with what you typed comes first — "911" should not be
    // buried under every model with a 9 in it.
    const starts = pool.filter((s) => s.toLowerCase().startsWith(q));
    const rest = pool.filter((s) => !s.toLowerCase().startsWith(q));
    return [...starts, ...rest].slice(0, MAX_SUGGESTIONS);
  }, [suggestions, value]);

  const pick = (v: string) => {
    (onSelect ?? onChangeText)(v);
    setFocused(false);
  };

  return (
    <View style={style}>
      {label ? <Text style={[styles.label, { color: colors.grey }]}>{label}</Text> : null}
      <TextInput
        style={inputStyle ?? [styles.input, {
          color: colors.fg, borderColor: colors.inputBorder, backgroundColor: colors.inputBg,
        }]}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        // Deferred: a tap on a suggestion blurs the field first, and closing on
        // blur would unmount the row out from under the finger.
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        placeholderTextColor={colors.grey}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />

      {focused && matches.length > 0 && (
        <View style={[styles.list, { borderColor: colors.inputBorder, backgroundColor: colors.card }]}>
          {matches.map((s, i) => (
            <TouchableOpacity
              key={s}
              style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
              onPress={() => pick(s)}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowText, { color: colors.fg }]} numberOfLines={1}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 15 },
  list:  { marginTop: 6, borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  row:   { paddingHorizontal: 12, paddingVertical: 11 },
  rowText: { fontSize: 14, fontWeight: '600' },
});
