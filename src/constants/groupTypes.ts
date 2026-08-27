/**
 * What kind of group this is, and — where the kind has them — what sort.
 *
 * Mirrors murray's src/types/groupTypes.js so a group created on the phone is
 * filed the same way as one created on the web. Only "Car Type" carries
 * categories; the rest are a type on their own, which is why the category row
 * only appears for that one.
 */
export const GROUP_TYPES: { key: string; label: string }[] = [
  { key: 'regional', label: 'Regional' },
  { key: 'national', label: 'National' },
  { key: 'single',   label: 'Single Make' },
  { key: 'type',     label: 'Car Type' },
  { key: 'other',    label: 'Other' },
];

export const GROUP_CATEGORIES: Record<string, { key: string; label: string }[]> = {
  regional: [],
  national: [],
  single:   [],
  type: [
    { key: 'sports',   label: 'Sports Cars' },
    { key: 'race',     label: 'Race Cars' },
    { key: 'overland', label: 'Overland/Offroad' },
    { key: 'vintage',  label: 'Vintage' },
    { key: 'modern',   label: 'Modern' },
    { key: 'other',    label: 'Other' },
  ],
  other: [],
};

export const groupTypeLabel = (key?: string) =>
  GROUP_TYPES.find((t) => t.key === key)?.label ?? '';

export const groupCategoriesFor = (type?: string) =>
  (type && GROUP_CATEGORIES[type]) || [];
