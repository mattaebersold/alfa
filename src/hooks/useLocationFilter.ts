import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EventLocationParams } from '../types/ors';
import { getDevicePosition } from '../utils/devicePosition';

/**
 * 'near' (or 'near:250'), 'all', or 'state:WA'.
 *
 * A bare region key ('northwest') is still understood — links into a list
 * from a profile's region tile carry one — but the filter no longer offers
 * them; it asks by state.
 */
export type LocationChoice = string;

/** How far "near me" reaches by default, in miles. */
export const NEAR_ME_MILES = 100;
/** The radius slider's range — the server clamps to the same 500. */
export const NEAR_MIN_MILES = 10;
export const NEAR_MAX_MILES = 500;

/**
 * Near me carries its radius in the choice itself: `'near'` is the default
 * NEAR_ME_MILES, and `'near:250'` is 250 miles. One string, so every screen's
 * filter draft — a plain choice on some, part of an object on others — holds
 * the radius without learning about it, and a draft that's reset or compared
 * keeps it along with the rest.
 */
export const isNear = (choice: LocationChoice) => choice === 'near' || choice.startsWith('near:');
/** The miles a near-me choice reaches. */
export function nearRadius(choice: LocationChoice): number {
  const n = Number(choice.split(':')[1]);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.max(n, NEAR_MIN_MILES), NEAR_MAX_MILES) : NEAR_ME_MILES;
}
/** The choice for near me at `miles` — plain `'near'` at the default. */
export const nearChoice = (miles: number) => (miles === NEAR_ME_MILES ? 'near' : `near:${miles}`);

/** A state choice carries its code the same way: `'state:WA'`. */
export const isStateChoice = (choice: LocationChoice) => choice.startsWith('state:');
/** The state code in a state choice, or null. */
export const choiceState = (choice: LocationChoice): string | null =>
  isStateChoice(choice) ? choice.slice(6).toUpperCase() || null : null;
/** The choice for one state. */
export const stateChoice = (code: string) => `state:${code.toUpperCase()}`;

// ── The phone's position ────────────────────────────────────────────────────

/**
 * How long a position stands for "where I am". Long enough that moving between
 * events, members and cars doesn't ask the GPS each time; short enough that
 * the drive to San Francisco shows up before you've parked.
 */
const POSITION_TTL_MS = 10 * 60 * 1000;

type Position = { lat: number; lng: number };
let cached: { pos: Position | null; at: number } | null = null;
let inFlight: Promise<Position | null> | null = null;

const freshPosition = (): Position | null | undefined =>
  cached && Date.now() - cached.at < POSITION_TTL_MS ? cached.pos : undefined;

/**
 * Where the phone is, once per POSITION_TTL_MS across the whole app — or null
 * when it can't say, which near me answers from the profile zip instead.
 */
function locateDevice(): Promise<Position | null> {
  const fresh = freshPosition();
  if (fresh !== undefined) return Promise.resolve(fresh);
  if (!inFlight) {
    inFlight = getDevicePosition()
      .catch(() => null)
      .then((pos) => {
        cached = { pos, at: Date.now() };
        inFlight = null;
        return pos;
      });
  }
  return inFlight;
}

/**
 * "Where" as a filter — events, members, their cars, routes, photo spots, the
 * marketplace.
 *
 * **Near me is where the phone is.** Away from home, near me means near here:
 * a member from Port Orchard standing in San Francisco sees San Francisco. The
 * app asks for location the first time near me is in play (see
 * utils/devicePosition) and sends `near_lat`/`near_lng`.
 *
 * Without a position — location declined, no fix — near me falls back to the zip on the member's profile (`near: 'me'`),
 * as it always used to. A member with neither gets `near_unavailable` back,
 * and the screen calls `fallBack` to show everything, saying why.
 *
 * While the phone is still finding itself (`locating`), the query runs on the
 * profile zip — something on screen rather than a spinner — and fallBack and
 * the widen-when-empty check hold off, so a home answer that's about to be
 * replaced can't move the filter to All under the member.
 *
 * **A state** is `state:WA`, and is matched against each thing's own state on
 * the server.
 *
 * `radius` is how far near me reaches — the default, or what the member set
 * on the slider — for screens that say "within N miles".
 */
export function useLocationFilter(initial: LocationChoice = 'near') {
  const [choice, setChoice] = useState<LocationChoice>(initial);
  /** Set when near me couldn't be answered and the filter moved to All. */
  const [fellBack, setFellBack] = useState(false);
  /** Set once the member picks a location themselves — a default no longer. */
  const [picked, setPicked] = useState(false);
  /**
   * Near me came back empty, so the list shows everything instead, under a
   * "No results near you" notice — see useNearFallback. The choice stays near
   * me; only the query widens.
   */
  const [others, setOthers] = useState(false);

  const [position, setPosition] = useState<Position | null>(() => freshPosition() ?? null);
  const [locating, setLocating] = useState(() => isNear(initial) && freshPosition() === undefined);
  const locatingRef = useRef(locating);
  locatingRef.current = locating;

  const near = isNear(choice);
  useEffect(() => {
    if (!near) return;
    let live = true;
    if (freshPosition() === undefined) setLocating(true);
    locateDevice().then((pos) => {
      if (!live) return;
      setPosition((prev) => {
        // A new place is a new near-me question: ask it before widening again.
        if (prev?.lat !== pos?.lat || prev?.lng !== pos?.lng) setOthers(false);
        return pos;
      });
      setLocating(false);
    });
    return () => { live = false; };
  }, [near]);

  const choose = useCallback((next: LocationChoice) => {
    setFellBack(false);
    setPicked(true);
    setOthers(false);
    setChoice(next);
  }, []);

  const showOthers = useCallback(() => setOthers(true), []);
  const resetOthers = useCallback(() => setOthers(false), []);

  const fallBack = useCallback(() => {
    // A no-zip answer while the phone is still locating is about to be
    // replaced by one measured from the phone.
    if (locatingRef.current) return;
    setChoice('all');
    setFellBack(true);
  }, []);

  const radius = near ? nearRadius(choice) : NEAR_ME_MILES;
  const state = choiceState(choice);
  // Memoised: screens key queries and memos on it, and a fresh object each
  // render made every one of them recompute for nothing.
  const params: EventLocationParams = useMemo(() => {
    if (choice === 'all') return {};
    if (near && others) return {};
    if (near) {
      return position
        ? { near_lat: position.lat, near_lng: position.lng, radius }
        : { near: 'me', radius };
    }
    if (state) return { state };
    return { region: choice };
  }, [choice, near, others, position, radius, state]);

  return {
    choice, choose, params, radius, fallBack, fellBack, picked,
    /** Near me had nothing; the list is everything, under a notice. */
    others: near && others,
    showOthers, resetOthers,
    /** The phone is still being asked where it is. */
    locating,
    /** Near me is measured from the phone, not the profile zip. */
    fromDevice: near && !!position,
  };
}

/**
 * When near me comes back with nothing, show everything else instead — the
 * screen keeps "Near me" chosen and puts NoResultsNear ("No results near
 * you", then "Other results") above the list, which is now every location.
 *
 * `settled` is the answer for the current near-me query being in (not a stale
 * one while the next loads); `empty` is whether it had anything. `key` is the
 * screen's other server-side filters (search, type…): when they change, near
 * me is asked again before widening, since the new question may have answers
 * nearby. Waits out `locating`: the first answer may be the profile zip's,
 * about to be replaced by the phone's.
 */
export function useNearFallback(
  location: ReturnType<typeof useLocationFilter>,
  { settled, empty, key = '' }: { settled: boolean; empty: boolean; key?: string },
) {
  const { choice, others, showOthers, resetOthers, locating } = location;
  const lastKey = useRef(key);
  useEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    resetOthers();
  }, [key, resetOthers]);
  useEffect(() => {
    if (others || !isNear(choice) || !settled || locating) return;
    if (empty) showOthers();
  }, [others, choice, settled, empty, locating, showOthers]);
}
