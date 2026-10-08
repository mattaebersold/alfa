import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { Heart } from 'lucide-react-native';
import { COLOR_LIKE } from '../../constants/config';

/**
 * The big heart that blooms over a card when you double-tap it.
 *
 * The rail's heart is in a corner, and the finger that double-tapped is
 * usually somewhere else — over the middle of the photo. This answers where
 * the finger is: a heart springs up there, holds a beat, and fades. Drawn
 * over the whole host, touch-transparent, so it never gets in the way of the
 * next tap.
 *
 * Plays each time `trigger` goes up; zero (the start) plays nothing.
 */
export default function LikeBurst({ trigger, size = 96 }: { trigger: number; size?: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!trigger) return;
    scale.value = 0.2;
    opacity.value = 1;
    scale.value = withSequence(
      withSpring(1.1, { damping: 7, stiffness: 300, mass: 0.6 }),
      withDelay(250, withTiming(1.35, { duration: 220 })),
    );
    opacity.value = withDelay(420, withTiming(0, { duration: 220 }));
  }, [trigger, scale, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.wrap, style]} pointerEvents="none">
      <Heart size={size} color={COLOR_LIKE} fill={COLOR_LIKE} strokeWidth={1.5} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
  },
});
