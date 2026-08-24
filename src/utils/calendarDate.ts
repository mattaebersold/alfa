/**
 * Reading a stored *calendar date* — an event's day, not an instant.
 *
 * Events, rallies and their occurrences have no time zone: "the 23rd" is the
 * 23rd wherever you read it. The API stores them at UTC midnight and sends them
 * as `2026-08-23T00:00:00.000Z`, so `new Date(value)` on a phone west of UTC
 * lands at 5pm on the 22nd — and every badge, list and calendar link built from
 * it showed the day before. A Sunday cars & coffee read "Sat 22".
 *
 * So these values are never parsed as instants. The calendar date is taken from
 * the string as written and rebuilt at local midnight, which is what the rest of
 * the app's date handling (date-fns `format`, `toLocaleDateString`, `getDate`)
 * expects to be given. Murray does the same thing from the other end, by
 * formatting with `timeZone: 'UTC'`.
 *
 * A `Date` passed in is already local and comes back untouched — the month
 * calendar builds its grid that way and must not be shifted.
 */

/** Leading "YYYY-MM-DD" of an ISO-ish string. */
const DATE_PART = /^(\d{4})-(\d{2})-(\d{2})/;

export function calendarDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const match = DATE_PART.exec(String(value));
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Sort key for a calendar date — local midnight in ms, or `fallback` when the
 * date is missing, so undated entries can be pushed to either end.
 */
export function calendarTime(value?: string | Date | null, fallback = 0): number {
  return calendarDate(value)?.getTime() ?? fallback;
}
