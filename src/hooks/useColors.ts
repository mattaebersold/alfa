// useColorScheme intentionally unused — app is dark-only
import { colors } from '../constants/colors';
import { useAppSelector } from '../store/store';
import {
  COLOR_GRAY_10,
  COLOR_GRAY_13,
  COLOR_GRAY_160,
  COLOR_GRAY_180,
  COLOR_GRAY_224,
  COLOR_GRAY_30,
  COLOR_GRAY_32,
  COLOR_GRAY_40,
  COLOR_GRAY_85,
} from '../constants/config';

// Dark-mode overrides — only surfaces that need to change from the light palette
export const DarkColors = {
  ...colors,
  // Backgrounds — matching Murray dark mode
  //
  // Darker than the cards that sit on it (#1e1e1e) by a wider margin than
  // before: at #121212 the two were close enough that a card read as a slightly
  // different patch of background rather than as an object on it.
  cream:    COLOR_GRAY_10,
  bg:       COLOR_GRAY_10,
  segment:  COLOR_GRAY_30,
  secondary:COLOR_GRAY_40,
  inputBg:  COLOR_GRAY_13,
  // Cards / surfaces
  card:     COLOR_GRAY_30,
  // Text
  fg:       COLOR_GRAY_224,
  muted:    COLOR_GRAY_160,
  // Borders
  border:   COLOR_GRAY_32,
  // Input
  inputBorder: COLOR_GRAY_85,
  // Grey — lighter on dark surfaces
  grey:     COLOR_GRAY_180,
} as const;

export type ThemeColors = typeof colors;

/**
 * Returns the correct color palette for the current color scheme and account type.
 * For pro/admin users, primaryAlt is remapped to primaryPro so all screens
 * automatically pick up the brand color without individual changes.
 */
export function useColors(): ThemeColors {
  const { userInfo } = useAppSelector((s) => s.auth);
  const isPro = userInfo?.accountType === 'pro' || userInfo?.accountType === 'admin';
  const base = DarkColors as unknown as ThemeColors;
  if (!isPro) return base;
  return { ...base, primaryAlt: colors.pro as unknown as typeof colors.primaryAlt };
}
