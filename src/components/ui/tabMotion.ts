import { Easing } from 'react-native';
import { LinearTransition, Easing as ReEasing } from 'react-native-reanimated';

/**
 * How MainTabs and SubTabs move: the thumb gliding to a picked tab — for
 * longer the further it goes (thumbMoveMs) — and the tabs and their track
 * easing to a new width when a label or count changes. Out, with a slight
 * overshoot — a touch past, then settled.
 */
export const TAB_MOVE_MS = 340;

/** The thumb's quickest move, to the tab next door, and its slowest, across the row. */
const THUMB_MIN_MS = 260;
const THUMB_MAX_MS = 560;
/** Extra time per point travelled — so a long jump isn't a blur and a short one isn't a crawl. */
const THUMB_MS_PER_PT = 0.9;

/** How long the thumb takes to travel `distance` points. */
export function thumbMoveMs(distance: number): number {
  return Math.min(THUMB_MAX_MS, Math.max(THUMB_MIN_MS, THUMB_MIN_MS + Math.abs(distance) * THUMB_MS_PER_PT));
}
/** How far past it goes before settling — slight. */
const OVERSHOOT = 1.3;

/** The thumb's curve (RN Animated). */
export const TAB_EASING = Easing.out(Easing.back(OVERSHOOT));

/** The same curve as a Reanimated layout transition, for the tabs and their track. */
export const TAB_LAYOUT = LinearTransition.duration(TAB_MOVE_MS).easing(ReEasing.out(ReEasing.back(OVERSHOOT)));
