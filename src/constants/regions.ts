/**
 * US regions members can be filtered by.
 *
 * Mirrors horacio's helpers/usRegions — the server owns which states belong to
 * which region, this is just the labels and the keys to ask for. Coarse on
 * purpose: the useful question on a members list is "who's near enough to drive
 * to a meet", which is a region, not a city.
 */
export const REGIONS: { key: string; label: string; states: string[] }[] = [
  { key: 'west',      label: 'West',      states: ['WA', 'OR', 'CA', 'NV', 'ID', 'MT', 'WY', 'UT', 'CO', 'AK', 'HI'] },
  { key: 'southwest', label: 'Southwest', states: ['AZ', 'NM', 'TX', 'OK'] },
  { key: 'midwest',   label: 'Midwest',   states: ['ND', 'SD', 'NE', 'KS', 'MN', 'IA', 'MO', 'WI', 'IL', 'MI', 'IN', 'OH'] },
  { key: 'southeast', label: 'Southeast', states: ['AR', 'LA', 'MS', 'AL', 'TN', 'KY', 'WV', 'VA', 'NC', 'SC', 'GA', 'FL'] },
  { key: 'northeast', label: 'Northeast', states: ['PA', 'NY', 'NJ', 'CT', 'RI', 'MA', 'VT', 'NH', 'ME', 'DE', 'MD', 'DC'] },
];

/**
 * The region a "City, ST" string falls in, or null.
 *
 * Reads the trailing abbreviation, so it can't be fooled by a state's letters
 * appearing inside a city name. Members whose signup geocode failed carry
 * "USA", which belongs to no region — that's a null, not a guess.
 */
export function regionForCityState(cityState?: string | null) {
  const match = cityState?.trim().match(/,\s*([A-Za-z]{2})\s*$/);
  if (!match) return null;
  const state = match[1].toUpperCase();
  return REGIONS.find((r) => r.states.includes(state)) ?? null;
}
