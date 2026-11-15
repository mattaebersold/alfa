import { navigateFromOutside } from '../../navigation/navigationRef';

/**
 * The PRO tab's Daily Games: home, on the PRO tab, at its landing. What every
 * "Play" that used to open the Car Spotter app does now. Through the
 * container's ref, so it works from a summary panel or a modal as well as a
 * screen. `at` makes asking again from the tab itself still land on the top.
 */
export function openDailyGames() {
  navigateFromOutside('MainTabs', {
    screen: 'FeedTab',
    params: { screen: 'Feed', params: { tab: 'pro', at: Date.now() } },
  });
}
