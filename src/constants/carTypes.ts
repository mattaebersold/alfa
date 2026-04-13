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
