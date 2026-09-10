export const CAR_TYPES = [
  { key: 'daily',        label: 'Daily Driver' },
  { key: 'weekend',      label: 'Weekend Warrior' },
  { key: 'project',      label: 'Project Car' },
  { key: 'garage-queen', label: 'Garage Queen' },
  { key: 'part-out',     label: 'Part Out' },
  { key: 'other',        label: 'Other' },
];

export const CAR_CATEGORIES: Record<string, { key: string; label: string }[]> = {
  daily: [
    { key: 'groceryGetter', label: 'Grocery Getter' },
    { key: 'beater',        label: 'Beater' },
    { key: 'shibox',        label: 'Shitbox' },
    { key: 'other',         label: 'Other' },
  ],
  weekend: [
    { key: 'carsAndCoffee', label: 'Cars & Coffee' },
    { key: 'canyonCarver',  label: 'Canyon Carver' },
    { key: 'race',          label: 'Race Car' },
    { key: 'historical',    label: 'Historical' },
  ],
  project: [
    { key: 'hopefulRestoration', label: 'Hopeful Restoration' },
    { key: 'lostCause',          label: 'Lost Cause' },
    { key: 'race',               label: 'Race Car' },
    { key: 'historical',         label: 'Historical' },
    { key: 'shibox',             label: 'Shitbox' },
    { key: 'other',              label: 'Other' },
  ],
  'garage-queen': [
    { key: 'concours',       label: 'Concours' },
    { key: 'specialOccasion',label: 'Special Occasion' },
    { key: 'race',           label: 'Race Car' },
    { key: 'historical',     label: 'Historical' },
    { key: 'other',          label: 'Other' },
  ],
  'part-out': [],
  other: [],
};

export const MOD_TYPES = [
  { key: 'general',    label: 'General' },
  { key: 'exterior',   label: 'Exterior' },
  { key: 'interior',   label: 'Interior' },
  { key: 'suspension', label: 'Suspension' },
  { key: 'chassis',    label: 'Chassis' },
  { key: 'engine',     label: 'Engine' },
  { key: 'other',      label: 'Other' },
];

export const CONDITIONS = [
  { key: 'excellent', label: 'Excellent' },
  { key: 'good',      label: 'Good' },
  { key: 'fair',      label: 'Fair' },
  { key: 'poor',      label: 'Poor' },
  { key: 'project',   label: 'Project' },
];

// Murray-style badge colors per car type. Here rather than on the card that
// draws them: the summary modal badges a car the same way, and the card
// already renders that modal — owning the palette too closed a require cycle.
export const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'daily':        { bg: '#F0D689', text: '#000' },
  'weekend':      { bg: '#35B5FF', text: '#000' },
  'project':      { bg: '#F36943', text: '#000' },
  'garage-queen': { bg: '#FF479C', text: '#000' },
  'part-out':     { bg: '#00FF3F', text: '#000' },
  'other':        { bg: '#F0D689', text: '#000' },
};

/** Every car type and category label, keyed the way they're stored. */
const LABELS: Record<string, string> = {};
CAR_TYPES.forEach((t) => { LABELS[t.key] = t.label; });
Object.values(CAR_CATEGORIES).flat().forEach((c) => { LABELS[c.key] = c.label; });

/**
 * The written label for a stored type or category key.
 *
 * The real label first, and only then a de-kebabbed, title-cased guess. The
 * guess alone turned `carsAndCoffee` into "Carsandcoffee" and `shibox` into
 * "Shibox" — the keys are camelCase, and there is no rule that recovers
 * "Cars & Coffee" from one. The list already has the answer; this asks it.
 */
export const formatLabel = (key?: string) => {
  if (!key) return null;
  return LABELS[key] ?? key.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
};
