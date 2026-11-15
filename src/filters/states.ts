/**
 * US states, the Location filter's unit of "where".
 *
 * Mirrors horacio's helpers/usStates. Regions (./regions) are still here for
 * the profile's map tile and for links that carry one, but the filter asks by
 * state: "Washington" is a place people know they're in, "the Northwest" is a
 * guess at where someone drew a line.
 */
export const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
];

/** The full name for a state code, or null. */
export function stateName(code?: string | null): string | null {
  const c = code?.trim().toUpperCase();
  return US_STATES.find((s) => s.code === c)?.name ?? null;
}

/**
 * The code for something typed — a code or a name, any case — or null.
 *
 * So typing "wa" or "washington" and leaving the field lands on Washington
 * just as tapping the suggestion would.
 */
export function stateCode(typed?: string | null): string | null {
  const v = typed?.trim().toLowerCase();
  if (!v) return null;
  return US_STATES.find((s) => s.code.toLowerCase() === v || s.name.toLowerCase() === v)?.code ?? null;
}

/** The state in a "City, ST" string, or null. */
export function stateForCityState(cityState?: string | null): string | null {
  const match = cityState?.trim().match(/,\s*([A-Za-z]{2})\s*$/);
  return match ? stateCode(match[1]) : null;
}
