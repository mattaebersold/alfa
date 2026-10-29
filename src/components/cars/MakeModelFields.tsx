import React from 'react';
import { MakeModelFields as KitMakeModelFields } from '@ors/kit';
import { useAutocompleteInputStyle } from '../ui/AutocompleteField';

// The kit's MakeModelFields: the same pair, built on its AutocompleteField,
// which keeps the suggestions above the keyboard inside a FormScrollView.
// Given the app's one field look; a caller's `inputStyle` is for size only.
export default function MakeModelFields(props: React.ComponentProps<typeof KitMakeModelFields>) {
  const inputStyle = useAutocompleteInputStyle(props.inputStyle);
  return <KitMakeModelFields {...props} inputStyle={inputStyle} />;
}
