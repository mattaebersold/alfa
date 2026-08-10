/**
 * "Add to calendar" for society events.
 *
 * Uses Google Calendar's template URL, which both iOS and Android open — the
 * Google Calendar app intercepts it when installed, otherwise it lands in the
 * browser. This keeps the feature dependency-free; wiring `expo-calendar` would
 * write straight to the device calendar but needs a native rebuild.
 *
 * Only the occurrence being viewed is exported, not the whole recurrence.
 */

/** "YYYYMMDDTHHMMSS" in local time. */
const stamp = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}00`
  );
};

/** Combine an occurrence date with an "HH:MM" time into one Date. */
const at = (date: string | Date, time: string | undefined, fallbackHour: number): Date => {
  const d = new Date(date);
  const [h, m] = (time ?? '').split(':').map(Number);
  d.setHours(Number.isNaN(h) ? fallbackHour : h, Number.isNaN(m) ? 0 : m || 0, 0, 0);
  return d;
};

export function googleCalendarUrl(
  event: {
    title?: string;
    body?: string;
    location?: string;
    start_time?: string;
    end_time?: string;
    date?: string;
    next_occurrence?: string | null;
  },
  occurrence?: string | null
): string | null {
  const base = occurrence || event.next_occurrence || event.date;
  if (!base) return null;

  const start = at(base, event.start_time, 10);
  // Without an end time, assume two hours.
  const end = event.end_time
    ? at(base, event.end_time, 12)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title ?? 'Event',
    dates: `${stamp(start)}/${stamp(end)}`,
    ...(event.location ? { location: event.location } : {}),
    ...(event.body ? { details: event.body.replace(/<[^>]+>/g, '').slice(0, 500) } : {}),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
