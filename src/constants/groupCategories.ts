/**
 * The categories group-style discussion and resources are filed under — shared
 * by a group's sections and a car model's page, which carry the same content.
 * Keys match horacio's GroupDiscussion / GroupResource schema enums.
 */

export const RESOURCE_CATEGORIES: { key: string; label: string }[] = [
  { key: 'general',     label: 'General' },
  { key: 'exterior',    label: 'Exterior' },
  { key: 'interior',    label: 'Interior' },
  { key: 'engine',      label: 'Engine' },
  { key: 'electrical',  label: 'Electrical' },
  { key: 'performance', label: 'Performance' },
  { key: 'suspension',  label: 'Suspension' },
  { key: 'brakes',      label: 'Brakes' },
  { key: 'visual',      label: 'Visual Mods' },
  { key: 'mechanics',   label: 'Shop/Mechanic' },
];

export const DISCUSSION_CATEGORIES: { key: string; label: string }[] = [
  { key: 'general',    label: 'General' },
  { key: 'engine',     label: 'Engine' },
  { key: 'chassis',    label: 'Chassis' },
  { key: 'electrical', label: 'Electrical' },
  { key: 'body',       label: 'Body' },
  { key: 'mods',       label: 'Mods' },
];
