import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventLocationParams } from '../types/api';

/** 'near', 'all', or a region key from constants/regions. */
export type LocationChoice = string;

/**
 * How far "near me" reaches, in miles — always. It used to be a choice of
 * three under the Near me chip, but nobody reads "50 mi" as a different place
 * from "100 mi", and it was the one filter setting that wasn't a single tap.
 */
export const NEAR_ME_MILES = 100;

/**
 * "Where" as a filter — events, members, their cars.
 *
 * Near me is measured from the zip on the member's profile, not the phone's
 * location: `near: 'me'` hands the question to the server, which knows the
 * zip. No location permission is asked for, and the answer is the same
 * wherever the phone happens to be — near me means near home.
 *
 * A member with no zip gets `near_unavailable` back from the server, and the
 * screen calls `fallBack` to show everything instead, saying why.
 *
 * `radius` is NEAR_ME_MILES, returned for screens that say "within N miles".
 *
 * And a default of near me that turns out to have nothing in it widens to All
 * — see useWidenWhenEmpty.
 */
export function useLocationFilter(initial: LocationChoice = 'near') {
  const [choice, setChoice] = useState<LocationChoice>(initial);
  /** Set when near me couldn't be answered and the filter moved to All. */
  const [fellBack, setFellBack] = useState(false);
  /** Set once the member picks a location themselves — a default no longer. */
  const [picked, setPicked] = useState(false);

  const choose = useCallback((next: LocationChoice) => {
    setFellBack(false);
    setPicked(true);
    setChoice(next);
  }, []);

  /** Near me, by default, had nothing: All instead, quietly. */
  const widen = useCallback(() => setChoice('all'), []);

  const fallBack = useCallback(() => {
    setChoice('all');
    setFellBack(true);
  }, []);

  const params: EventLocationParams =
    choice === 'all' ? {} : choice === 'near' ? { near: 'me', radius: NEAR_ME_MILES } : { region: choice };

  return { choice, choose, params, radius: NEAR_ME_MILES, fallBack, fellBack, picked, widen };
}

/**
 * Open on All rather than an empty screen: when the default near me comes
 * back with nothing, widen it — once, and only while near me is still the
 * default. A near me the member chose, or one narrowed by a search, is
 * allowed to be empty.
 *
 * `settled` is the first answer for the current near-me query being in (not
 * a stale one while the next loads); `empty` is whether it had anything.
 */
export function useWidenWhenEmpty(
  location: ReturnType<typeof useLocationFilter>,
  { settled, empty, narrowed = false }: { settled: boolean; empty: boolean; narrowed?: boolean },
) {
  const checked = useRef(false);
  const { choice, picked, widen } = location;
  useEffect(() => {
    if (checked.current || picked || choice !== 'near' || narrowed || !settled) return;
    checked.current = true;
    if (empty) widen();
  }, [choice, picked, narrowed, settled, empty, widen]);
}
