import type { RouteCondition } from '../types/api';

/**
 * What a drive was like — the light, the sky and the road — picked as chips,
 * several at once. Mirrors horacio's DrivingRoute CONDITIONS; anything the
 * server doesn't know is dropped there.
 */
export const ROUTE_CONDITIONS: { key: RouteCondition; label: string }[] = [
  { key: 'day',      label: 'Day' },
  { key: 'night',    label: 'Night' },
  { key: 'dusk',     label: 'Dusk / Dawn' },
  { key: 'sunny',    label: 'Sunny' },
  { key: 'overcast', label: 'Overcast' },
  { key: 'rainy',    label: 'Rainy' },
  { key: 'foggy',    label: 'Foggy' },
  { key: 'snowy',    label: 'Snowy' },
  { key: 'icy',      label: 'Icy' },
  { key: 'wet',      label: 'Wet roads' },
  { key: 'windy',    label: 'Windy' },
  { key: 'traffic',  label: 'Traffic' },
];

const LABELS = new Map(ROUTE_CONDITIONS.map((c) => [c.key, c.label]));

/** A condition's label, or null for one this build doesn't know. */
export const conditionLabel = (key: string) => LABELS.get(key as RouteCondition) ?? null;
