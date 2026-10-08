import React, { useEffect, useRef } from 'react';
import Animated, {
  useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { Heart } from 'lucide-react-native';

/**
 * The like heart, with a pop when it fills.
 *
 * A colour change on an icon the size of a fingertip was easy to miss — the
 * finger is over it at the moment it changes. Going from not-liked to liked
 * now swells it past its size, settles it back with a little wiggle either
 * side, so the like registers even at the edge of your eye. Unliking just
 * changes the colour: taking one back isn't an event.
 *
 * Only on a change — never on mount, so a feed full of already-liked posts
 * doesn't all bounce as it scrolls in.
 */
export default function AnimatedHeart({ liked, size, color, fill, strokeWidth }: {
  liked: boolean;
  size: number;
  color: string;
  fill: string;
  strokeWidth?: number;
}) {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const was = useRef(liked);

  useEffect(() => {
    if (liked && !was.current) {
      scale.value = withSequence(
        withTiming(1.45, { duration: 110 }),
        withSpring(1, { damping: 6, stiffness: 260, mass: 0.6 }),
      );
      rotate.value = withSequence(
        withTiming(-14, { duration: 70 }),
        withTiming(12, { duration: 90 }),
        withTiming(-7, { duration: 80 }),
        withTiming(4, { duration: 70 }),
        withTiming(0, { duration: 60 }),
      );
    }
    was.current = liked;
  }, [liked, scale, rotate]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <Heart size={size} color={color} fill={fill} strokeWidth={strokeWidth} />
    </Animated.View>
  );
}
