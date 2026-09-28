import { useMemo } from 'react';
import { useGetUserGarageQuery } from '../api/apiService';
import { useAppSelector } from '../store/store';

/** "Mercedes-Benz", "mercedes-benz" and "mercedes_benz" all as "mercedesbenz". */
const norm = (s?: string | null) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Which makes, models and generations are in your own garage — for the gold
 * sparkle on the Brands grid and a make's model tiles, and to lead both lists
 * with them. Each is matched on its handle or its name, whichever the car has.
 */
export function useGarageMatch() {
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const { data } = useGetUserGarageQuery(undefined, { skip: !isLoggedIn });

  return useMemo(() => {
    const makes = new Set<string>();
    const models = new Set<string>();
    const generations = new Set<string>();
    for (const c of data?.entries ?? []) {
      const make = norm(c.make_handle || c.make);
      const model = norm(c.model_handle || c.model);
      const gen = norm(c.generation_handle || c.generation);
      if (!make) continue;
      makes.add(make);
      if (model) models.add(`${make}|${model}`);
      if (model && gen) generations.add(`${make}|${model}|${gen}`);
    }
    return {
      ownsMake: (make: string) => makes.has(norm(make)),
      ownsModel: (make: string, model: string) => models.has(`${norm(make)}|${norm(model)}`),
      ownsGeneration: (make: string, model: string, generation: string) =>
        generations.has(`${norm(make)}|${norm(model)}|${norm(generation)}`),
    };
  }, [data]);
}
