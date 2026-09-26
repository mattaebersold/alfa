import React, { useEffect, useMemo } from 'react';
import AutocompleteField from '../ui/AutocompleteField';
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
export default function GenerationField({ make, model, year, value, onChange }: {
  make: string;
  model: string;
  year?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { data: gens = [] } = useGetCarGenerationsQuery(
    { make: make.trim(), model: model.trim() },
    { skip: !make.trim() || !model.trim() },
  );
  const names = useMemo(() => gens.map((g) => g.name), [gens]);

  // A generation from a different model doesn't belong once the model changes.
  useEffect(() => {
    if (value && gens.length && !names.some((n) => n.toLowerCase() === value.toLowerCase())) onChange('');
  }, [names]); // eslint-disable-line react-hooks/exhaustive-deps

  // From the year, when exactly one generation fits and nothing's chosen yet.
  useEffect(() => {
    if (value || gens.length < 2) return;
    const y = Number(String(year ?? '').match(/\d{4}/)?.[0]);
    if (!y) return;
    const fits = gens.filter((g) => (g.start == null || y >= g.start) && (g.end == null || y <= g.end));
    if (fits.length === 1) onChange(fits[0].name);
  }, [year, gens]); // eslint-disable-line react-hooks/exhaustive-deps

  if (gens.length < 2) return null;

  const hint = gens
    .map((g) => `${g.name}${g.start ? ` ${g.start}–${g.end ?? 'now'}` : ''}`)
    .join(' · ');

  return (
    <AutocompleteField
      label="Generation"
      value={value}
      onChangeText={onChange}
      suggestions={names}
      placeholder={`e.g. ${names[names.length - 1]}`}
      autoCapitalize="none"
      message={hint}
    />
  );
}
