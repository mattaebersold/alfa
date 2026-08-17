import { useCallback } from 'react';
import {
  useGetLoggedInUserQuery,
  useUpdateFeedPreferencesMutation,
} from '../api/apiService';

/**
 * The home feed's "stop showing me this" state.
 *
 * Both dismissals live on the user record rather than on the device, so closing
 * a module on your phone also closes it on your tablet. That makes the logged-in
 * user query the source of truth here — the auth slice's cached `userInfo` is
 * written at sign-in and wouldn't see a change made later in the session.
 *
 * A temporary hide is stored as a date rather than counted down, so nothing has
 * to run to bring the rows back: the comparison below simply stops being true.
 */
export function useFeedPreferences() {
  const { data: user } = useGetLoggedInUserQuery();
  const [updatePreferences] = useUpdateFeedPreferencesMutation();

  const prefs = user?.feedPreferences;

  const suggestionsHidden = (() => {
    if (prefs?.hideSuggestions === 'permanent') return true;
    if (prefs?.hideSuggestions !== 'temporary') return false;
    const until = prefs.hideSuggestionsUntil ? new Date(prefs.hideSuggestionsUntil).getTime() : 0;
    return Number.isFinite(until) && until > Date.now();
  })();

  const hideSuggestions = useCallback(
    (mode: 'temporary' | 'permanent') => updatePreferences({ hideSuggestions: mode }),
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

  return { suggestionsHidden, hideSuggestions, dismissBanner, isBannerDismissed };
}
