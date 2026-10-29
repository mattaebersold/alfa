import React from 'react';
import { AutocompleteField as KitAutocompleteField } from '@ors/kit';
import { useColors } from '../../hooks/useColors';
import { useInputSurface, INPUT_TEXT_STYLE } from './FormInput';

/**
 * The field style the kit's autocomplete fields take here: a FormInput's —
 * the shared surface, its type and padding. A caller's `inputStyle` is laid
 * over it (size and margins only); the kit's red `invalid` edge still lands
 * on top.
 */
export function useAutocompleteInputStyle(inputStyle?: any) {
  const colors = useColors();
  const surface = useInputSurface();
  return [surface, INPUT_TEXT_STYLE, { paddingHorizontal: 14, paddingVertical: 12, color: colors.fg }, inputStyle];
}

// The kit's AutocompleteField: its suggestions float over the form, above the
// field while the keyboard is up. Given the app's one field look.
export default function AutocompleteField(props: React.ComponentProps<typeof KitAutocompleteField>) {
  const inputStyle = useAutocompleteInputStyle(props.inputStyle);
  return <KitAutocompleteField {...props} inputStyle={inputStyle} />;
}
