import { useAppSelector } from '../store/store';
import { colors } from '../constants/colors';
import { useColors } from './useColors';

export function useIsPro(): boolean {
  const { userInfo } = useAppSelector((s) => s.auth);
  return userInfo?.accountType === 'pro' || userInfo?.accountType === 'admin';
}

function perceivedBrightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/** Returns the active brand color (primaryAlt or primaryPro for pro users). */
export function useBrandColor(): string {
  const c = useColors();
  return c.primaryAlt;
}

/** Returns white or black depending on perceived brightness of the brand color. */
export function useBrandTextColor(): '#FFFFFF' | '#000000' {
  const brand = useBrandColor();
  return perceivedBrightness(brand) < 128 ? '#FFFFFF' : '#000000';
}
