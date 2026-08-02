import { useAppSelector } from '../store/store';
import { colors } from '../constants/colors';
import { useColors } from './useColors';

export function useIsPro(): boolean {
  const { userInfo } = useAppSelector((s) => s.auth);
  return userInfo?.accountType === 'pro' || userInfo?.accountType === 'admin';
}

/**
 * Perceived brightness (0–255) of a `#rrggbb` or `rgb(r, g, b)` color.
 * Both forms appear in the palette — `primaryAlt` is an rgb() string.
 */
function perceivedBrightness(color: string): number {
  let r: number, g: number, b: number;

  const rgb = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    [r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  } else {
    const hex = color.replace('#', '');
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    r = parseInt(full.slice(0, 2), 16);
    g = parseInt(full.slice(2, 4), 16);
    b = parseInt(full.slice(4, 6), 16);
  }

  if ([r, g, b].some(Number.isNaN)) return 0;
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/**
 * Readable foreground for text/icons sitting on `bg`. Light fills like the gold
 * brand color get black; dark fills get white.
 */
export function contrastText(bg: string): '#FFFFFF' | '#000000' {
  return perceivedBrightness(bg) < 140 ? '#FFFFFF' : '#000000';
}

/** Returns the active brand color — gold for pro/admin users, primaryAlt otherwise. */
export function useBrandColor(): string {
  const c = useColors();
  const isPro = useIsPro();
  return isPro ? c.pro : c.primaryAlt;
}

/** Returns white or black depending on perceived brightness of the brand color. */
export function useBrandTextColor(): '#FFFFFF' | '#000000' {
  const brand = useBrandColor();
  return perceivedBrightness(brand) < 128 ? '#FFFFFF' : '#000000';
}
