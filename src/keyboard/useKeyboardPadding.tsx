import React from 'react';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';

/**
 * Bottom padding that eases from `closed` to `open` in step with the keyboard.
 *
 * A bar at the foot of the screen wants the home indicator's clearance while
 * the keyboard is down, and none once it's sitting on the keyboard. Switching
 * between the two on a keyboard *event* made the bar hop: the padding changed
 * in one frame while the keyboard was still mid-rise, so the icons jumped and
 * then rode up the rest of the way — the bobbing on Android. This follows the
 * keyboard's own progress on the UI thread instead, so the clearance melts
 * away exactly as the keyboard covers it.
 *
 * Returns an animated style: put it on a Reanimated `Animated.View`.
 */
export function useKeyboardPadding({ closed, open }: { closed: number; open: number }) {
  const { progress } = useReanimatedKeyboardAnimation();
  return useAnimatedStyle(() => ({
    paddingBottom: open + (closed - open) * (1 - progress.value),
  }), [closed, open]);
}

/**
 * The home indicator's clearance as a view of its own, collapsing as the
 * keyboard rises — for the foot of a bar or sheet that can't take an animated
 * style (one already on another animation system), or whose height is being
 * measured: put this *after* the measured part, and the measurement stays
 * put while the keyboard moves.
 */
export function HomeIndicatorSpacer({ height }: { height: number }) {
  const { progress } = useReanimatedKeyboardAnimation();
  const style = useAnimatedStyle(() => ({ height: height * (1 - progress.value) }), [height]);
  return <Animated.View style={style} />;
}
