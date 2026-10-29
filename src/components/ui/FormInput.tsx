import React from 'react';
import { StyleSheet, type TextInput as RNTextInput, type TextInputProps, type ViewStyle } from 'react-native';
import { TextInput } from '@ors/kit';
import { useColors } from '../../hooks/useColors';
import { FORM_RADIUS, INPUT_TEXT, INPUT_LINE_HEIGHT } from '../../constants/config';

/**
 * Every text field in the app: a dark fill edged in grey, the form's radius,
 * the input type — the create form's "What's on your mind?" field, made the
 * one look.
 *
 * `multiline` makes it a paragraph field, tall to start with. Anything else
 * passes straight through to the TextInput, and `style` is laid over the
 * standard one for a field that needs its own size or margin — not its own
 * colours or edge.
 *
 * Where a field is a box with other things in it (a search icon, a clear
 * button, a mention list), the box takes `useInputSurface()` and the bare
 * TextInput inside it takes `INPUT_TEXT_STYLE`.
 */
export default function FormInput({ style, multiline, placeholderTextColor, ref, ...rest }: TextInputProps & { ref?: React.Ref<RNTextInput> }) {
  const colors = useColors();
  return (
    <TextInput
      ref={ref}
      multiline={multiline}
      placeholderTextColor={placeholderTextColor ?? colors.grey}
      style={[
        styles.field,
        multiline && styles.multi,
        { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.fg },
        style,
      ]}
      {...rest}
    />
  );
}

/** The field's box alone — fill, edge and corners — for a field built from a box with a bare input in it. */
export function useInputSurface(): ViewStyle {
  const colors = useColors();
  return { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, borderWidth: 1, borderRadius: FORM_RADIUS };
}

/** The type a bare input inside an input surface takes, so it reads the same as a FormInput. */
export const INPUT_TEXT_STYLE = INPUT_TEXT;

const styles = StyleSheet.create({
  field: {
    borderWidth: 1, borderRadius: FORM_RADIUS,
    paddingHorizontal: 14, paddingVertical: 12,
    ...INPUT_TEXT,
  },
  multi: { lineHeight: INPUT_LINE_HEIGHT, minHeight: 110, textAlignVertical: 'top' },
});
