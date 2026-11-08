import React, { useCallback, useMemo, useState } from 'react';
import AttendCarSheet from './AttendCarSheet';
import {
  useGetMyEventsQuery, useGetUserGarageQuery, useToggleEventInterestMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { occurrenceDate, eventDayKey } from '../../constants/eventTypes';
import type { SocietyEvent } from '../../types/api';

/** An event's date, as attending is keyed — one card, one occurrence. */
const keyOf = (event: SocietyEvent) => `${event.internal_id}|${eventDayKey(event, occurrenceDate(event)) ?? ''}`;

/**
 * Attend, for a whole grid of event cards at once (EventsView).
 *
 * The same toggle and car picker as an event's own Attend (useEventInterest),
 * but held once by the grid rather than once per card: a card used to bring
 * its own My Events and garage subscriptions, two mutations and a picker
 * sheet, twenty times over, and every one of them re-rendered on each change.
 * Here the cards get plain props — whether they're lit, whether they're busy,
 * what to call — and there's one sheet.
 */
export function useGridInterest() {
  const loggedIn = !!useAppSelector((s) => s.auth.userInfo);
  const { data } = useGetMyEventsQuery(undefined, { skip: !loggedIn });
  const { data: garage } = useGetUserGarageQuery(undefined, { skip: !loggedIn });
  const [toggle] = useToggleEventInterestMutation();
  const cars = garage?.entries ?? [];

  /** What the server says you're going to, as card keys. */
  const going = useMemo(() => {
    const set = new Set<string>();
    for (const e of data?.entries ?? []) set.add(`${e.internal_id}|${e.day ?? ''}`);
    return set;
  }, [data]);
  /** Taps not yet settled by the server: the card shows the answer it asked for. */
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  /** The event whose car is being picked, before it's attended. */
  const [picking, setPicking] = useState<SocietyEvent | null>(null);

  const isInterested = useCallback((event: SocietyEvent) => {
    const k = keyOf(event);
    if (k in optimistic) return optimistic[k];
    return data ? going.has(k) : !!event.is_interested;
  }, [optimistic, going, data]);

  const attend = useCallback(async (event: SocietyEvent, carId?: string | null) => {
    const k = keyOf(event);
    const day = eventDayKey(event, occurrenceDate(event));
    const next = !isInterested(event);
    setOptimistic((o) => ({ ...o, [k]: next }));
    setBusy((b) => new Set(b).add(k));
    try {
      const res = await toggle({
        event_id: event.internal_id,
        ...(day ? { day } : {}),
        ...(carId !== undefined ? { car_id: carId } : {}),
      }).unwrap();
      setOptimistic((o) => ({ ...o, [k]: res.is_interested }));
    } catch {
      setOptimistic((o) => { const { [k]: _, ...rest } = o; return rest; });
    } finally {
      setBusy((b) => { const n = new Set(b); n.delete(k); return n; });
    }
  }, [isInterested, toggle]);

  /** Going, with cars in the garage: ask which first. Otherwise straight through. */
  const onToggle = useCallback((event: SocietyEvent) => {
    if (!isInterested(event) && cars.length > 0) setPicking(event);
    else attend(event);
  }, [isInterested, cars.length, attend]);

  const isBusy = useCallback((event: SocietyEvent) => busy.has(keyOf(event)), [busy]);

  const sheet = (
    <AttendCarSheet
      visible={picking !== null}
      cars={cars}
      onClose={() => setPicking(null)}
      onChoose={(carId) => { if (picking) attend(picking, carId); }}
    />
  );

  return { isInterested, isBusy, onToggle, sheet };
}
