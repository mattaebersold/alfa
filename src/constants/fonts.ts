import { Platform } from 'react-native';
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';

import { FONT_INTER } from '@ors/kit';

/**
 * The app's face — Inter, for everything: headings, body, labels, inputs.
 * The names live in the kit (theme/fonts), so its components and this app's
 * agree on them; the font files are loaded here. See the kit's note on why
 * each weight is its own family.
 */
export { FONT_INTER };

/**
 * Monospace — for the What's New button and panel only, where it reads as
 * release notes rather than as the app talking. Everywhere else is Inter. The
 * platforms' own mono, so there's no file to load; unlike Inter, `fontWeight`
 * works with it as usual.
 */
export const FONT_MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** What App.tsx loads before the first screen draws — keyed by the names above. */
export const FONT_FILES = {
  [FONT_INTER.light]: Inter_300Light,
  [FONT_INTER.regular]: Inter_400Regular,
  [FONT_INTER.medium]: Inter_500Medium,
  [FONT_INTER.semibold]: Inter_600SemiBold,
  [FONT_INTER.bold]: Inter_700Bold,
  [FONT_INTER.extrabold]: Inter_800ExtraBold,
  [FONT_INTER.black]: Inter_900Black,
};
