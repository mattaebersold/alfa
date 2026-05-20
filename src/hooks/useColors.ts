import { useColorScheme } from 'react-native';
import { colors } from '../constants/colors';
import { useAppSelector } from '../store/store';

// Dark-mode overrides — only surfaces that need to change from the light palette
export const DarkColors = {
  ...colors,
  // Backgrounds — matching Murray dark mode
  cream:    '#121212',
  bg:       '#121212',
  segment:  '#1E1E1E',
  secondary:'#282828',
  inputBg:  '#0D0D0D',
  // Cards / surfaces
  card:     '#252525',
  // Text
  fg:       '#E0E0E0',
  muted:    '#A0A0A0',
  // Borders
  border:   '#3C3C3C',
  // Input
  inputBorder: '#555555',
  // Grey — lighter on dark surfaces
  grey:     '#B4B4B4',
} as const;

export type ThemeColors = typeof colors;

/**
 * Returns the correct color palette for the current color scheme and account type.
 * For pro/admin users, primaryAlt is remapped to primaryPro so all screens
 * automatically pick up the brand color without individual changes.
 */
export function useColors(): ThemeColors {
  const scheme = useColorScheme();
  const { userInfo } = useAppSelector((s) => s.auth);
  const isPro = userInfo?.accountType === 'pro' || userInfo?.accountType === 'admin';
  const base = scheme === 'dark' ? (DarkColors as unknown as ThemeColors) : colors;
  if (!isPro) return base;
  return { ...base, primaryAlt: colors.primaryPro as unknown as typeof colors.primaryAlt };
}
