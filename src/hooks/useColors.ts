import { useColorScheme } from 'react-native';
import { Colors } from '../constants/colors';

// Dark-mode overrides — only surfaces that need to change from the light palette
export const DarkColors = {
  ...Colors,
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

export type ThemeColors = typeof Colors;

/**
 * Returns the correct color palette for the current color scheme.
 * Components should call this hook and use the returned object
 * instead of importing Colors directly, to support dark mode.
 */
export function useColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? (DarkColors as unknown as ThemeColors) : Colors;
}
