/**
 * Society event presentation constants — mirrors murray's helpers/eventHelpers.js
 * so an event reads the same on both platforms.
 */
import { calendarDate } from '../utils/calendarDate';

// One hex per category, used by the card's header bar and the calendar dots so
// a colour means the same thing in both places. Kept deliberately distinct and
// light enough for black text. Mirrored in murray's helpers/eventHelpers.js —
// change both together.
export const EVENT_CATEGORIES: { key: string; label: string; color: string }[] = [
  { key: 'cars-and-coffee',   label: 'Cars & Coffee',  color: '#C6F24E' },
  { key: 'drive',             label: 'Drive',          color: '#35B5FF' },
  { key: 'show',              label: 'Show',           color: '#FF6FA5' },
  { key: 'tech-session',      label: 'Tech Session',   color: '#FFB020' },
  { key: 'motorsports',       label: 'Motorsports',    color: '#FF5C39' },
  { key: 'misc',              label: 'Misc',           color: '#B8C0C8' },
];

/**
 * The gold worn by events ORS runs or backs (`ors_sponsored`). Deliberately
 * outside the category palette so it never reads as another category.
 * Mirrored in murray's helpers/eventHelpers.js — change both together.
 */
export const ORS_EVENT_COLOR = '#CDA96F';

export const categoryFor = (key?: string) =>
  EVENT_CATEGORIES.find((c) => c.key === key) ?? EVENT_CATEGORIES[EVENT_CATEGORIES.length - 1];

/** "YYYY-MM-DD" → local Date, avoiding the UTC shift `new Date(str)` applies. */
export const parseDayKey = (key?: string | null): Date | null => {
  if (!key) return null;
  const [y, m, d] = String(key).split('-').map(Number);
  return (y && m && d) ? new Date(y, m - 1, d) : null;
};

/**
 * "YYYY-MM-DD" for a date.
 *
 * Reads stored dates as calendar dates rather than instants — otherwise editing
 * an event and saving it moved the date back a day, because the key sent to the
 * server was derived from the phone's local reading of a UTC-midnight stamp.
 */
export const toDayKey = (date: Date | string): string => {
  const d = calendarDate(date) ?? new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

/** "18:30" → "6:30 PM". Times are local wall-clock strings. */
export const formatTime = (time?: string | null): string | null => {
  if (!time) return null;
  const [h, m] = String(time).split(':').map(Number);
  if (Number.isNaN(h)) return time;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m || 0).padStart(2, '0')} ${period}`;
};

export const formatEventDate = (
  date?: string | Date | null,
  opts: { weekday?: boolean; year?: boolean } = {}
): string => {
  const d = calendarDate(date);
  if (!d) return '';
  return d.toLocaleDateString('en-US', {
    ...(opts.weekday && { weekday: 'short' }),
    month: 'short',
    day: 'numeric',
    ...(opts.year && { year: 'numeric' }),
  });
};

/**
 * A multi-day event's dates, or null for a one-day one: "Sep 19 – 21" within a
 * month, "Sep 30 – Oct 2" across one. Short on purpose — it sits on one line
 * of a card, and the day of the week is the first thing to go.
 */
export const formatEventRange = (event?: {
  frequency?: string;
  date?: string;
  end_date?: string | null;
} | null): string | null => {
  if (event?.frequency !== 'single' || !event.end_date) return null;
  const first = calendarDate(event.date);
  const last = calendarDate(event.end_date);
  if (!first || !last || last <= first) return null;
  const month = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' });
  return first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()
    ? `${month(first)} ${first.getDate()} – ${last.getDate()}`
    : `${month(first)} ${first.getDate()} – ${month(last)} ${last.getDate()}`;
};

/**
 * One entry per multi-day event, on the first of its days in the list.
 *
 * A calendar wants a weekend show on all three days; a carousel wants it
 * once, saying "Sep 19 – 21". The server already collapses its upcoming list
 * this way — this keeps any list that's fed occurrences from showing the same
 * event three cards in a row regardless.
 */
export function collapseMultiDay<T extends { internal_id: string; frequency?: string; end_date?: string | null }>(
  entries: T[],
): T[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    if (e.frequency !== 'single' || !e.end_date) return true;
    if (seen.has(e.internal_id)) return false;
    seen.add(e.internal_id);
    return true;
  });
}

/** The date a card should show: this occurrence, else the event's next one. */
export const occurrenceDate = (event?: {
  occurrence_date?: string;
  next_occurrence?: string | null;
  frequency?: string;
  date?: string;
} | null): string | null | undefined =>
  event?.occurrence_date || event?.next_occurrence || (event?.frequency === 'single' ? event?.date : null);
