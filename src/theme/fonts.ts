/**
 * The face every ORS app is set in, by family name: Inter, for everything.
 *
 * Names only. The font files are the app's to load (alfa: constants/fonts'
 * FONT_FILES, via useFonts in App.tsx), because these components have no dependencies
 * of its own; an app that hasn't loaded them falls back to the system font.
 *
 * One family name per weight, and no `fontWeight` beside it: a custom font
 * can't be bolded by weight the way the system font can — Android ignores it
 * and iOS may fall back to the system font trying — so the weight *is* the
 * family. Pick the key that matches the weight you'd have written.
 */
export const FONT_INTER = {
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
} as const;
