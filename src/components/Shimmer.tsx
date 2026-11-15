import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, Easing, interpolate,
} from 'react-native-reanimated';
import OilSheen, { useSheenTone, type SheenTone } from './OilSheen';
import { useBrandColor, useIsPro } from '../theme/useColors';

/**
 * The brand fill, with its shimmer.
 *
 * Blue for basic members, gold for Pro — alfa's `useBrandColor` — under alfa's
 * oil-slick film (OilSheen), with a band of light that sweeps across every few
 * seconds so the surface catches the eye the way metal flake does. The sweep is
 * the one thing alfa's static sheen doesn't do; it's what makes a primary
 * button or the header badge read as *the* thing to press.
 *
 * Renders its children on top. Clips to `radius` itself so a shadowed parent
 * doesn't have to.
 */
export default function Shimmer({
  radius = 10, style, children, sweep = true, sheen = true, color, tone: toneOverride,
}: {
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** The moving band of light. */
  sweep?: boolean;
  /** alfa's static oil film under the band. */
  sheen?: boolean;
  /** Override the fill — e.g. the success green on a won game. */
  color?: string;
  /**
   * Override the film's tone, which otherwise follows the *viewer's* account.
   * For a surface about someone else — a Pro member's ring on their profile is
   * gold whoever is looking at it.
   */
  tone?: SheenTone;
}) {
  const brand = useBrandColor();
  const viewerTone = useSheenTone();
  const tone = toneOverride ?? viewerTone;
  const pos = useSharedValue(-1);

  useEffect(() => {
    if (!sweep) return;
    pos.value = withRepeat(
      withDelay(1800, withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) })),
      -1,
      false,
    );
  }, [sweep, pos]);

  /**
   * Fades in and out at the ends of its pass. On a surface the band doesn't
   * fully cross — a small ring — it used to stop mid-surface and vanish, then
   * sit visible through the pause; faded, it ends softly and waits unseen.
   */
  const band = useAnimatedStyle(() => ({
    opacity: interpolate(pos.value, [-1, -0.6, 0.4, 1], [0, 1, 1, 0]),
    transform: [{ translateX: `${pos.value * 120}%` as any }, { rotate: '18deg' }],
  }));

  return (
    <View style={[{ backgroundColor: color ?? brand, borderRadius: radius, overflow: 'hidden' }, style]}>
      {sheen && <OilSheen tone={tone} radius={radius} />}
      {sweep && (
        <Animated.View pointerEvents="none" style={[styles.band, band]}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
      {children}
    </View>
  );
}

/** For a caller that just needs to know which tone the shimmer is in. */
export function useShimmerIsGold(): boolean {
  return useIsPro();
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute', top: '-50%', bottom: '-50%', left: 0, width: '45%',
  },
});
