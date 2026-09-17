import { useCallback } from 'react';
import {
  useGetLoggedInUserQuery,
  useUpdateFeedPreferencesMutation,
} from '../api/apiService';
import type { FeedPreferences, HideMode, SetupPrompt } from '../types/api';

/** The home feed's closable suggestion rows. */
export type SuggestionRow = 'members' | 'cars';

const ROW_KEY = {
  members: 'hideSuggestedMembers',
  cars: 'hideSuggestedCars',
} as const;

/** Whether a stored mode, with its expiry, currently means hidden. */
function isHidden(mode?: HideMode, until?: string | null): boolean {
  if (mode === 'permanent') return true;
  if (mode !== 'temporary') return false;
  const ends = until ? new Date(until).getTime() : 0;
  return Number.isFinite(ends) && ends > Date.now();
}

/**
 * The home feed's "stop showing me this" state.
 *
 * Every dismissal lives on the user record rather than on the device, so closing
 * a module on your phone also closes it on your tablet. That makes the logged-in
 * user query the source of truth here — the auth slice's cached `userInfo` is
 * written at sign-in and wouldn't see a change made later in the session.
 *
 * A temporary hide is stored as a date rather than counted down, so nothing has
 * to run to bring a row back: the comparison simply stops being true.
 */
export function useFeedPreferences() {
  const { data: user } = useGetLoggedInUserQuery();
  const [updatePreferences] = useUpdateFeedPreferencesMutation();

  const prefs: FeedPreferences | undefined = user?.feedPreferences;

  /**
   * Each suggestion row closes on its own. The old both-at-once setting still
   * counts, so anyone who closed the pair before this keeps them closed.
   */
  const isRowHidden = useCallback((row: SuggestionRow) => {
    const key = ROW_KEY[row];
    return isHidden(prefs?.[key], prefs?.[`${key}Until`])
      || isHidden(prefs?.hideSuggestions, prefs?.hideSuggestionsUntil);
  }, [prefs]);

  const hideRow = useCallback(
    (row: SuggestionRow, mode: 'temporary' | 'permanent') =>
      updatePreferences({ [ROW_KEY[row]]: mode }),
    [updatePreferences],
  );

  const dismissBanner = useCallback(
    (bannerId: string) => updatePreferences({ dismissedHomeBannerId: bannerId }),
    [updatePreferences],
  );

  /** True while this exact banner has been closed — a new upload mints a new id. */
  const isBannerDismissed = useCallback(
    (bannerId?: string | null) => !!bannerId && prefs?.dismissedHomeBannerId === bannerId,
    [prefs?.dismissedHomeBannerId],
  );

  /** Steps of the profile setup card waved off — for good, on every device. */
  const dismissedSetupPrompts = prefs?.dismissedSetupPrompts ?? [];

  const dismissSetupPrompt = useCallback(
    (step: SetupPrompt) => updatePreferences({ dismissSetupPrompt: step }),
    [updatePreferences],
  );

  return {
    isRowHidden, hideRow, dismissBanner, isBannerDismissed,
    dismissedSetupPrompts, dismissSetupPrompt,
  };
}
