import { useIsPro } from './useBrandColor';
import { COLOR_COUNT_BADGE, COLOR_ON_ALERT, COLOR_RED, COLOR_WHITE } from '../constants/config';

/**
 * The colours of a count bubble, an unread dot or a numbered prompt: the bell,
 * the menu's tiles, messages, group requests, the profile-setup steps.
 *
 * Pro members get the alert blue with black lettering. Everyone else gets red
 * with white lettering, the colour people already read as "something's
 * waiting".
 */
export function useCountBadge(): { bg: string; fg: string } {
  const isPro = useIsPro();
  return isPro ? { bg: COLOR_COUNT_BADGE, fg: COLOR_ON_ALERT } : { bg: COLOR_RED, fg: COLOR_WHITE };
}
