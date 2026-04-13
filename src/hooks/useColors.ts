import { useColorScheme } from 'react-native';
import { Colors } from '../constants/colors';

// Dark-mode overrides — only surfaces that need to change from the light palette
export const DarkColors = {
  ...Colors,
  // Backgrounds
  cream:    '#141414',
  bg:       '#141414',
  segment:  '#1E1E1E',
  secondary:'#2A2A2A',
  inputBg:  '#1A1A1A',
  // Cards / surfaces
  card:     '#1E1E1E',
  // Text
  fg:       '#E8E8E8',
  muted:    '#AAAAAA',
  // Borders
  border:   '#3C3C3C',
  // Input
  inputBorder: '#555555',
  // Keep brand colors unchanged
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
