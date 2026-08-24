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
export function isRallyUpcoming(rally?: Pick<Rally, 'event_date'> | null): boolean {
  if (!rally?.event_date) return true;
  // The rally's own day, not the instant it was stamped at — compared as an
  // instant, a rally counted as past from midnight *the day before* it ran.
  const date = calendarDate(rally.event_date);
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
