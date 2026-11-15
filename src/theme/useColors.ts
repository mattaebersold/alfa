import { useOrsSelector } from '../store/createStore';
import { colors, perceivedBrightness, type ThemeColors } from './colors';

/** Pro and admin members get the gold; everyone else the blue. */
export function useIsPro(): boolean {
  const accountType = useOrsSelector((s) => s.auth.userInfo?.accountType);
  return accountType === 'pro' || accountType === 'admin';
}

export function useIsAdmin(): boolean {
  return useOrsSelector((s) => s.auth.userInfo?.accountType) === 'admin';
}

/**
 * The palette for this member. For Pro, `primaryAlt` is remapped to the gold so
 * every screen written against it follows the account without asking.
 */
export function useColors(): ThemeColors {
  const isPro = useIsPro();
  return isPro ? { ...colors, primaryAlt: colors.pro } : colors;
}

/** The active brand colour — gold for Pro/admin, blue otherwise. */
export function useBrandColor(): string {
  return useIsPro() ? colors.pro : colors.primaryAlt;
}

/** White or black, whichever reads on the brand colour. */
export function useBrandTextColor(): '#FFFFFF' | '#000000' {
  return perceivedBrightness(useBrandColor()) < 128 ? '#FFFFFF' : '#000000';
}
