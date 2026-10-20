import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import AutocompleteField from '../ui/AutocompleteField';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useGetCarGenerationsQuery } from '../../api/apiService';

/**
 * Which generation of the model — "993" of a 911, "Mk2" of a Jetta.
 *
 * Only there when the model has more than one (the reference list's
 * generations); otherwise it renders nothing and the value stays empty.
 * Optional either way. With a year and no choice yet, it picks the one
 * generation whose years contain it — a changeover year that two share is
 * left for the owner.
 */
export default function GenerationField({ make, model, year, value, onChange, highlight = false }: {
  make: string;
  model: string;
  year?: string;
  value: string;
  onChange: (v: string) => void;
  /**
   * Draw attention while it's empty — for a car saved before generations
   * existed, opened for editing. Gone once one is chosen.
   */
  highlight?: boolean;
}) {
  const brand = useBrandColor();
  const { data: gens = [] } = useGetCarGenerationsQuery(
    { make: make.trim(), model: model.trim() },
    { skip: !make.trim() || !model.trim() },
  );
  const names = useMemo(() => gens.map((g) => g.name), [gens]);

  /**
   * A new make or model starts the generation over: cleared outright — even
   * when the new model has generations of the same name, or none at all — and
   * then picked again from the year below, if one fits. Not on the first
   * render, so a car opened for editing keeps the generation it was saved with.
   */
  const carKey = `${make.trim().toLowerCase()}|${model.trim().toLowerCase()}`;
  const lastCar = useRef(carKey);
  useEffect(() => {
    if (lastCar.current === carKey) return;
    // From no model to one is the form filling in — a car opened for editing
    // loads its make and model a moment after the form mounts — not a change.
    const hadModel = !lastCar.current.endsWith('|');
    lastCar.current = carKey;
    if (hadModel && value) onChange('');
  }, [carKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // From the year, when exactly one generation fits and nothing's chosen yet.
  useEffect(() => {
    if (value || gens.length < 2) return;
    const y = Number(String(year ?? '').match(/\d{4}/)?.[0]);
    if (!y) return;
    const fits = gens.filter((g) => (g.start == null || y >= g.start) && (g.end == null || y <= g.end));
    if (fits.length === 1) onChange(fits[0].name);
  }, [year, gens]); // eslint-disable-line react-hooks/exhaustive-deps

  if (gens.length < 2) return null;

  const field = (
    <AutocompleteField
      label="Generation (optional)"
      value={value}
      onChangeText={onChange}
      suggestions={names}
      placeholder={`e.g. ${names[names.length - 1]}`}
      autoCapitalize="none"
      // A line under it only while it's asking to be filled.
      message={highlight && !value ? `New — choose which ${model.trim()} this is.` : undefined}
      // Under the model field, as the model is under the make.
      style={highlight && !value ? undefined : { marginTop: 16 }}
    />
  );
  if (!highlight || value) return field;

  // A tinted panel in the account's colour around the field: the one thing on
  // the form that's new since the car was saved.
  return (
    <View style={[styles.highlight, { borderColor: brand, backgroundColor: `${brand}14` }]}>
      {field}
    </View>
  );
}

const styles = StyleSheet.create({
  highlight: { marginTop: 16, padding: 10, borderRadius: 12, borderWidth: 1 },
});
