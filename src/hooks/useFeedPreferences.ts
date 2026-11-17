import { useCallback, useMemo } from 'react';
import {
  useGetLoggedInUserQuery,
  useUpdateFeedPreferencesMutation,
} from '../api/apiService';
import type {
  FeedPreferences, FeedSort, FeedContent, FeedContentKey, HideMode, SetupPrompt,
} from '../types/api';

/** The feed's orders, in the order the panel lists them. See horacio's helpers/feedPrefs. */
export const FEED_SORTS: { key: FeedSort; label: string; description?: string }[] = [
  { key: 'auto',      label: 'Auto',          description: 'People you follow, near you and in your groups' },
  { key: 'recent',    label: 'All recent',    description: 'Everything, newest first, whoever posted it' },
  { key: 'popular',   label: 'Most popular' },
  { key: 'following', label: 'Following' },
];

/** The kinds of row the feed mixes, in the order the panel lists them. */
export const FEED_CONTENT: { key: FeedContentKey; label: string }[] = [
  { key: 'posts',     label: 'Posts' },
  { key: 'cars',      label: 'Garage cars' },
  { key: 'mods',      label: 'Mods' },
  { key: 'galleries', label: 'Galleries' },
  { key: 'routes',    label: 'Routes' },
  { key: 'groups',    label: 'Group activity' },
];

export const DEFAULT_FEED_SORT: FeedSort = 'auto';
export const DEFAULT_FEED_CONTENT: FeedContent = {
  posts: true, cars: true, mods: true, galleries: true, routes: true, groups: true,
};

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

  /**
   * How the home feed is built. Read through the defaults, so an account the
   * server's backfill hasn't reached — or a signed-out visitor — gets the feed
   * as it always was.
   */
  const feedSort: FeedSort = prefs?.sort ?? DEFAULT_FEED_SORT;
  const feedContent = useMemo<FeedContent>(
    () => ({ ...DEFAULT_FEED_CONTENT, ...prefs?.content }),
    [prefs?.content],
  );

  /** Saved to the account, applied at once (see the mutation's optimistic patch). */
  const setFeedPrefs = useCallback(
    (next: { sort?: FeedSort; content?: Partial<FeedContent> }) => updatePreferences(next),
    [updatePreferences],
  );

  return {
    isRowHidden, hideRow, dismissBanner, isBannerDismissed,
    dismissedSetupPrompts, dismissSetupPrompt,
    feedSort, feedContent, setFeedPrefs,
  };
}
