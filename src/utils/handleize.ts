/**
 * A display value as the slug the API stores alongside it.
 *
 * Mirrors horacio's `helpers/utils.handleize` character for character — cars
 * carry `make_handle` / `model_handle` derived that way, and a value built to
 * different rules simply doesn't match a stored one.
 *
 * Worth having on this side because the car listing filters on those slugs. The
 * updated server also matches the display field case-insensitively, but the
 * deployed one does not, so what the app sends has to be a real handle to work
 * against both.
 */
export function handleize(value?: string | null): string {
  // Trimmed first and stripped of edge dashes last: a trailing space would
  // otherwise become a trailing dash, which is a different slug. See the note
  // on horacio's copy — two real cars were stored that way.
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
