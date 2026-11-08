// useColorScheme intentionally unused — app is dark-only
import { colors } from '../constants/colors';
import { useAppSelector } from '../store/store';
import {
  APP_BG,
  COLOR_GRAY_160,
  COLOR_GRAY_180,
  COLOR_GRAY_224,
  COLOR_GRAY_40,
  COLOR_GRAY_85, SURFACE_BLACK, SURFACE_MID, COLOR_LINE
} from '../constants/config';

// Dark-mode overrides — only surfaces that need to change from the light palette
export const DarkColors = {
  ...colors,
  // Backgrounds — the three surfaces (SURFACE_* in constants/config): the
  // app's dark grey ground, the medium grey cards on it.
  cream:    APP_BG,
  bg:       APP_BG,
  segment:  SURFACE_MID,
  secondary:COLOR_GRAY_40,
  inputBg:  SURFACE_BLACK,
  // Cards / surfaces
  card:     SURFACE_MID,
  // Text
  fg:       COLOR_GRAY_224,
  muted:    COLOR_GRAY_160,
  // Borders
  border:   COLOR_LINE,
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
