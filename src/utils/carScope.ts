/**
 * The key a car model's discussion and resources are cached under — the
 * group id's stand-in for content that lives on a model's page rather than in
 * a group (see horacio's helpers/carScope). Lower-cased so "Porsche 924" and
 * "porsche 924" are one list.
 */
export function carScopeKey(make?: string | null, model?: string | null): string {
  return `car:${String(make ?? '').trim().toLowerCase()}/${String(model ?? '').trim().toLowerCase()}`;
}
