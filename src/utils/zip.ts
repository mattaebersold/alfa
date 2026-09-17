/**
 * Zip rules, mirroring horacio's helpers/zip.
 *
 * Five digits, US only. The zip is never shown to anyone — it exists to be
 * geocoded into the city and state on the profile, the region every filter
 * sorts by, the map tile, and the point "near me" measures from. Anything else
 * geocodes to nothing useful, and the member ends up filed under nowhere with
 * no sign of why.
 */

const ZIP = /^\d{5}$/;

/** Keystroke filter: digits only, and never more than five of them. */
export function sanitizeZip(raw: string): string {
  return raw.replace(/[^0-9]/g, '').slice(0, 5);
}

/** A message explaining why `raw` can't be a zip, or null if it can. */
export function validateZip(raw: string): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return 'Please enter your zip code.';
  return ZIP.test(value) ? null : 'Enter a 5-digit US zip code.';
}
