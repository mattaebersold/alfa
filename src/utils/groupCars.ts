import type { Group, GroupCar } from '../types/api';

/** A group's cars — its list, or, from a server or group older than lists, its one make/model pair. */
export function groupCarsOf(g: Pick<Group, 'group_cars' | 'group_make' | 'group_model'> | null | undefined): GroupCar[] {
  if (g?.group_cars?.length) return g.group_cars;
  return g?.group_make ? [{ make: g.group_make, model: g.group_model ?? null }] : [];
}

/** "Porsche 911" — or just "BMW", for a make-wide one. */
export const groupCarLabel = (c: GroupCar) => [c.make, c.model].filter(Boolean).join(' ');

/**
 * A group's cars in one short line: "Porsche 911", "Porsche 911 +2". With
 * `make`/`model`, the pair that fits them leads — on the 993's page, a group
 * of the 911, 993 and 964 reads "Porsche 993 +2".
 */
export function groupCarsLine(g: Parameters<typeof groupCarsOf>[0], make?: string, model?: string): string {
  const cars = groupCarsOf(g);
  if (!cars.length) return '';
  const low = (s?: string | null) => (s ?? '').trim().toLowerCase();
  const fits = (c: GroupCar) => low(c.make) === low(make) && (!model || !c.model || low(c.model) === low(model));
  const lead = (make && (cars.find((c) => fits(c) && c.model) ?? cars.find(fits))) || cars[0];
  const more = cars.length - 1;
  return more ? `${groupCarLabel(lead)} +${more}` : groupCarLabel(lead);
}
