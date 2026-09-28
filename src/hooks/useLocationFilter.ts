import { useCallback, useState } from 'react';
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
 */
export function useLocationFilter(initial: LocationChoice = 'near') {
  const [choice, setChoice] = useState<LocationChoice>(initial);
  /** Set when near me couldn't be answered and the filter moved to All. */
  const [fellBack, setFellBack] = useState(false);

  const choose = useCallback((next: LocationChoice) => {
    setFellBack(false);
    setChoice(next);
  }, []);

  const fallBack = useCallback(() => {
    setChoice('all');
    setFellBack(true);
  }, []);

  const params: EventLocationParams =
    choice === 'all' ? {} : choice === 'near' ? { near: 'me', radius: NEAR_ME_MILES } : { region: choice };

  return { choice, choose, params, radius: NEAR_ME_MILES, fallBack, fellBack };
}
