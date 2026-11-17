import { navigateFromOutside } from '../../navigation/navigationRef';

/** PRO's Games option — see sections/pro.tsx. */
export const PRO_GAMES_SUB = 'games';

/**
 * The PRO tab's Games option: home, on the PRO tab, on Games. Through the
 * container's ref, so it works from a summary panel or a modal as well as a
 * screen. `at` makes asking again from the tab itself still land. What every
 * "Play" that used to open the Car Spotter app does now. Takes nothing, so
 * it can be an onPress as is.
 */
export function openDailyGames() {
  navigateFromOutside('MainTabs', {
    screen: 'FeedTab',
    params: { screen: 'Feed', params: { tab: 'pro', sub: PRO_GAMES_SUB, at: Date.now() } },
  });
}
