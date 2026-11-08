import * as Haptics from 'expo-haptics';

/**
 * The app's taps you can feel — one place, so every control of a kind feels
 * the same. Fire-and-forget: no permissions or native setup behind them, and a
 * no-op on a device without a haptic engine.
 */

/** Switching between tabs or segments — the light "tick" of a picker. */
export function selectionHaptic(): void {
  Haptics.selectionAsync().catch(() => {});
}

/** Opening something — a menu, a drawer. A touch firmer than a selection. */
export function openHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
