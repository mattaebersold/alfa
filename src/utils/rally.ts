/**
 * Airtable serves its normal form URLs with `X-Frame-Options: SAMEORIGIN`, which
 * a WebView honours exactly as a browser does — a pasted share link renders as a
 * refusal page instead of the form. The `/embed/` variant of the same path drops
 * that header, so rewrite to it; that way an admin can paste either URL into the
 * rally's form field and it works either way.
 *
 * Mirrors the same rewrite in murray/src/components/pages/rallys/Detail.js, which
 * needs it for its iframe. Non-Airtable URLs pass through untouched — the field
 * is just "a registration form", and nothing here assumes a provider.
 */
import type { Rally } from '../types/api';
import { calendarDate } from './calendarDate';

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * A rally's two livery colours, always resolved to a usable pair.
 *
 * The colours are optional on the model and the calendar tile is a gradient, so
 * every combination has to land somewhere sensible: no colours at all falls back
 * to the caller's brand colour, and one colour alone becomes both stops — a
 * gradient between a colour and itself is just that colour, which is exactly
 * what an admin who filled in only "primary" is asking for.
 *
 * The regex guard matters because these strings go straight into styles: the
 * server normalises what it stores, but rallys created before the fields existed
 * have neither, and a malformed value should degrade to the brand rather than
 * render an invalid colour.
 */
export function rallyColors(rally: Pick<Rally, 'primary_color' | 'secondary_color'>, fallback: string): [string, string] {
  const primary = rally.primary_color && HEX.test(rally.primary_color) ? rally.primary_color : null;
  const secondary = rally.secondary_color && HEX.test(rally.secondary_color) ? rally.secondary_color : null;
  const base = primary ?? secondary ?? fallback;
  return [primary ?? base, secondary ?? base];
}

/**
 * Is this rally still ahead of us?
 *
 * Registration only belongs on a rally you can still join, so this gates the
 * embedded form. A rally with no date at all counts as upcoming — an undated
 * rally is one an admin hasn't finished scheduling, not one that has passed.
 */
export function isRallyUpcoming(rally?: Pick<Rally, 'event_date' | 'end_date'> | null): boolean {
  if (!rally?.event_date) return true;
  // The rally's own day, not the instant it was stamped at — compared as an
  // instant, a rally counted as past from midnight *the day before* it ran.
  // The *last* day, so a rally mid-run still counts as on.
  const date = calendarDate(rally.end_date ?? rally.event_date);
  if (!date) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() >= today.getTime();
}

export function toRallyFormEmbedUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('airtable.com')) return url;
    if (parsed.pathname.startsWith('/embed/')) return url;
    parsed.pathname = `/embed${parsed.pathname}`;
    return parsed.toString();
  } catch {
    // Not a parseable URL — hand it back and let the WebView fail visibly
    // rather than silently dropping a form an admin thinks is configured.
    return url;
  }
}

/**
 * A rally's run as one readable line: "Aug 14, 2026", "Aug 14 – 16, 2026",
 * "Aug 30 – Sep 1, 2026" or "Dec 30, 2026 – Jan 2, 2027".
 *
 * The month and year are only repeated when they actually change across the
 * span, so the common case — a weekend inside one month — reads as a range
 * rather than as two full dates.
 *
 * Dates are read in UTC: rally days are stored as midnight, and reading them
 * locally shows the previous day west of Greenwich. Mirrors murray's
 * helpers/rally.js — change both together.
 */
export function rallyDateRange(
  rally?: Pick<Rally, 'event_date' | 'end_date'> | null,
  { month = 'short' }: { month?: 'short' | 'long' } = {},
): string | null {
  if (!rally?.event_date) return null;

  const start = new Date(rally.event_date);
  const end = rally.end_date ? new Date(rally.end_date) : null;
  const fmt = (date: Date, opts: Intl.DateTimeFormatOptions) =>
    date.toLocaleDateString('en-us', { timeZone: 'UTC', ...opts });
  const full: Intl.DateTimeFormatOptions = { year: 'numeric', month, day: 'numeric' };

  if (!end || end <= start) return fmt(start, full);

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();

  if (sameMonth) {
    return `${fmt(start, { month, day: 'numeric' })} – ${fmt(end, { day: 'numeric' })}, ${end.getUTCFullYear()}`;
  }
  if (sameYear) {
    return `${fmt(start, { month, day: 'numeric' })} – ${fmt(end, { month, day: 'numeric' })}, ${end.getUTCFullYear()}`;
  }
  return `${fmt(start, full)} – ${fmt(end, full)}`;
}

/**
 * "Fri, Aug 14" — enough to place a single itinerary day without repeating the
 * year the range above already gave.
 */
export function rallyDayDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-us', {
    timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric',
  });
}
