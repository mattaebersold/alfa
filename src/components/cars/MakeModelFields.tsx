import React from 'react';
import { View, StyleSheet } from 'react-native';
import AutocompleteField from '../ui/AutocompleteField';
import { useGetCarBrandsQuery, useGetCarModelsQuery } from '../../api/apiService';

/**
 * Make and model, offered from what the club already owns.
 *
 * The two fields are paired because the second depends on the first: models
 * are fetched for whichever make is in the box, so picking "Porsche" turns the
 * model field into a list of Porsches. Murray's garage form has worked this way
 * for a while; here the make was a half-autocomplete and the model was a row of
 * chips that vanished for any make with no models on file.
 *
 * Both remain free text. A car nobody has entered before still has to be
 * enterable, and the suggestions are a shortcut rather than a gate.
 */
export default function MakeModelFields({
  make,
  model,
  onMakeChange,
  onModelChange,
  required = false,
  style,
  inputStyle,
}: {
  make: string;
  model: string;
  onMakeChange: (v: string) => void;
  onModelChange: (v: string) => void;
  required?: boolean;
  style?: any;
  inputStyle?: any;
}) {
  const { data: brands = [] } = useGetCarBrandsQuery();
  // Skipped until there's a make: the endpoint is per-brand, and asking for
  // the models of "" returns nothing worth waiting for.
  const { data: models = [] } = useGetCarModelsQuery(make.trim(), { skip: !make.trim() });

  return (
    <View style={style}>
      <AutocompleteField
        label={required ? 'Make *' : 'Make'}
        value={make}
        onChangeText={onMakeChange}
        onSelect={(v) => {
          onMakeChange(v);
          // The old model belonged to the old make.
          if (model) onModelChange('');
        }}
        suggestions={brands}
        placeholder="e.g. Porsche"
        inputStyle={inputStyle}
      />

      <AutocompleteField
        label={required ? 'Model *' : 'Model'}
        value={model}
        onChangeText={onModelChange}
        suggestions={models.map((m) => m.model)}
        placeholder={make.trim() ? `e.g. ${models[0]?.model ?? '911'}` : 'Pick a make first'}
        style={styles.second}
        inputStyle={inputStyle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  second: { marginTop: 14 },
});
