import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { COLOR_GRAY_42, COMMON_RADIUS } from '../../constants/config';

/**
 * Dark grey stand-ins for content that hasn't arrived.
 *
 * A screen or panel draws its real layout with these in the places the
 * content will take, so a tap is answered at once by the shape of the thing
 * rather than by a spinner in a void. They breathe — a slow opacity pulse on
 * the native driver, which costs nothing on the JS thread — so a long load
 * still reads as alive.
 */
const PULSE_MS = 900;

/** One shared pulse, so every box on a screen breathes together. */
let pulse: Animated.Value | null = null;
const sharedPulse = () => {
  if (pulse) return pulse;
  pulse = new Animated.Value(0);
  Animated.loop(
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: PULSE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: PULSE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]),
  ).start();
  return pulse;
};

export function Skeleton({
  width,
  height,
  radius = 10,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useRef(sharedPulse()).current;
  const opacity = useRef(p.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] })).current;
  return (
    <Animated.View
      style={[styles.box, { width, height, borderRadius: radius, opacity }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** A line of text that isn't here yet. */
export function SkeletonLine({ width = '70%', height = 14, style }: { width?: number | `${number}%`; height?: number; style?: StyleProp<ViewStyle> }) {
  return <Skeleton width={width} height={height} radius={height / 2} style={style} />;
}

/**
 * A card-shaped stand-in: a picture over two lines. `ratio` is the picture's
 * width over its height, so the box is the size the photo will be.
 */
export function SkeletonCard({ ratio = 1.5, style }: { ratio?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, style]}>
      <Skeleton style={{ width: '100%', aspectRatio: ratio }} radius={COMMON_RADIUS} />
      <View style={styles.lines}>
        <SkeletonLine width="60%" height={16} />
        <SkeletonLine width="35%" height={12} />
      </View>
    </View>
  );
}

/** A column of cards, for a list that hasn't loaded. */
export function SkeletonList({ count = 3, ratio = 1.5, style }: { count?: number; ratio?: number; style?: StyleProp<ViewStyle> }) {
  const keys = useRef(Array.from({ length: count }, (_, i) => i)).current;
  return (
    <View style={style}>
      {keys.map((k) => <SkeletonCard key={k} ratio={ratio} />)}
    </View>
  );
}

/** Two columns of cards, for a grid that hasn't loaded. */
export function SkeletonGrid({ count = 6, ratio = 1, gap = 12, style }: { count?: number; ratio?: number; gap?: number; style?: StyleProp<ViewStyle> }) {
  const keys = useRef(Array.from({ length: count }, (_, i) => i)).current;
  return (
    <View style={[styles.grid, { gap }, style]}>
      {[0, 1].map((col) => (
        <View key={col} style={[styles.column, { gap }]}>
          {keys.filter((k) => k % 2 === col).map((k) => <SkeletonCard key={k} ratio={ratio} style={styles.gridCard} />)}
        </View>
      ))}
    </View>
  );
}

/** Rows of an avatar beside two lines, for a list of people. */
export function SkeletonPeople({ count = 6, style }: { count?: number; style?: StyleProp<ViewStyle> }) {
  const keys = useRef(Array.from({ length: count }, (_, i) => i)).current;
  return (
    <View style={style}>
      {keys.map((k) => (
        <View key={k} style={styles.person}>
          <Skeleton width={48} height={48} radius={24} />
          <View style={styles.personLines}>
            <SkeletonLine width="45%" height={14} />
            <SkeletonLine width="30%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** A row of avatars or tiles, for a horizontal shelf. */
export function SkeletonRow({ count = 4, size = 72, radius = size / 2, style }: { count?: number; size?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const keys = useRef(Array.from({ length: count }, (_, i) => i)).current;
  return (
    <View style={[styles.row, style]}>
      {keys.map((k) => <Skeleton key={k} width={size} height={size} radius={radius} />)}
    </View>
  );
}

/**
 * Content arriving over its stand-ins: fades up on mount, on the native
 * driver, so the swap from grey boxes to the real thing is a settle rather
 * than a pop. Wrap the loaded branch in it.
 */
export function FadeIn({ children, duration = 220, style }: { children: React.ReactNode; duration?: number; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [opacity, duration]);
  return <Animated.View style={[{ opacity }, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  box: { backgroundColor: COLOR_GRAY_42 },
  card: { marginBottom: 16 },
  lines: { paddingHorizontal: 4, paddingTop: 10, gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  grid: { flexDirection: 'row' },
  column: { flex: 1 },
  gridCard: { marginBottom: 0 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  personLines: { flex: 1, gap: 8 },
});
