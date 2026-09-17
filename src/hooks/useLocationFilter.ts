import { useCallback, useState } from 'react';
import type { EventLocationParams } from '../types/api';

/** 'near', 'all', or a region key from constants/regions. */
export type LocationChoice = string;

/** How far "near me" reaches, in miles. The middle one is the default. */
export const RADIUS_OPTIONS = [50, 100, 500];

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
 * `radius` only means anything while near me is the choice.
 */
export function useLocationFilter(initial: LocationChoice = 'near') {
  const [choice, setChoice] = useState<LocationChoice>(initial);
  const [radius, setRadius] = useState(100);
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
    choice === 'all' ? {} : choice === 'near' ? { near: 'me', radius } : { region: choice };

  return { choice, choose, params, radius, setRadius, fallBack, fellBack };
}
