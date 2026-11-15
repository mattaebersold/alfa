import React from 'react';
import BaseMakeModelFields from '../MakeModelFields';
import { useAutocompleteInputStyle } from '../ui/AutocompleteField';

// The shared MakeModelFields: the same pair, built on its AutocompleteField,
// which keeps the suggestions above the keyboard inside a FormScrollView.
// Given the app's one field look; a caller's `inputStyle` is for size only.
export default function MakeModelFields(props: React.ComponentProps<typeof BaseMakeModelFields>) {
  const inputStyle = useAutocompleteInputStyle(props.inputStyle);
  return <BaseMakeModelFields {...props} inputStyle={inputStyle} />;
}
