import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '../../hooks/useColors';

/** More than this and it's a list to scroll, not a shortcut. */
const MAX_SUGGESTIONS = 8;

/**
 * A text field that offers what's already known.
 *
 * On its own it doesn't insist: whatever is typed is the value, and the known
 * ones are one tap away. A caller that must only ever hold a listed value (the
 * make and model fields) keeps the typed text apart from the value it commits,
 * and uses `message` to say when the two disagree — see MakeModelFields.
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
  onBlur,
  editable = true,
  message,
  invalid = false,
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
  /** Called on blur, as it happens — before a tapped suggestion lands. */
  onBlur?: () => void;
  editable?: boolean;
  /** A line under the field: a hint, or with `invalid`, what's wrong. */
  message?: string;
  /** Outlines the field in red and colours `message` to match. */
  invalid?: boolean;
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
    if (!editable) return;
    (onSelect ?? onChangeText)(v);
    setFocused(false);
  };

  return (
    <View style={style}>
      {label ? <Text style={[styles.label, { color: colors.fg }]}>{label}</Text> : null}
      <TextInput
        style={[
          inputStyle ?? [styles.input, {
            // `card`, not `inputBg`: the plain text fields these sit among use the
            // lighter ground, and side by side the darker one read as a disabled
            // field rather than a different component.
            color: colors.fg, borderColor: colors.inputBorder, backgroundColor: colors.card,
          }],
          invalid && { borderColor: colors.red },
          !editable && styles.inputOff,
        ]}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        onFocus={() => setFocused(true)}
        // Deferred: a tap on a suggestion blurs the field first, and closing on
        // blur would unmount the row out from under the finger.
        onBlur={() => {
          onBlur?.();
          setTimeout(() => setFocused(false), 150);
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.grey}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />

      {focused && editable && matches.length > 0 && (
        <View style={[styles.list, { borderColor: colors.inputBorder, backgroundColor: colors.segment }]}>
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

      {/* After the list, not between it and the field: a message that appears
          on blur would otherwise shove the rows down under a finger that is
          already on its way to one. */}
      {message ? (
        <Text style={[styles.message, { color: invalid ? colors.red : colors.grey }]}>{message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Matched to the plain text fields these sit among — they were a smaller
  // uppercase label over a taller, tighter-cornered box, so Make and Model
  // read as a different kind of field from every other one on the form.
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15,
  },
  inputOff: { opacity: 0.5 },
  message: { fontSize: 12, fontWeight: '600', marginTop: 6, lineHeight: 16 },
  list:  { marginTop: 6, borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  row:   { paddingHorizontal: 12, paddingVertical: 11 },
  rowText: { fontSize: 14, fontWeight: '600' },
});
