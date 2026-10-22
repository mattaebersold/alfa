import React, { useEffect } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop } from 'react-native-svg';

/**
 * A rev counter that reads a multi-step form's progress — the needle climbs a
 * step at a time and drops back when you go back.
 *
 * After a classic sports-car tach: black face, white ticks on a 0–8 scale,
 * concentric lines through the range ending in a red block at the redline
 * (see LINES), and a white needle under a grey hub. No numerals — at
 * header size they were texture, not numbers. Step 1 sits on the first tick
 * (0); the last step sits at the redline (7), where the form is ready to go.
 *
 * Drawn on a 100×100 grid and scaled to `size`. The needle is its own layer,
 * rotated as a view, so the spring runs on the UI thread.
 */

const MAX = 8;
const SWEEP = 240; // degrees, 0 at lower left to 8 at lower right
const IDLE = 0;
const REDLINE = 7;

const RED = '#E3262B';
const INK = '#F2F2F2';

/** Degrees clockwise from 12 o'clock for a reading. */
const angleFor = (v: number) => -SWEEP / 2 + (v / MAX) * SWEEP;

/** A point on the dial, `r` from the centre, at reading `v`. */
const polar = (v: number, r: number) => {
  const a = (angleFor(v) * Math.PI) / 180;
  return { x: 50 + r * Math.sin(a), y: 50 - r * Math.cos(a) };
};

/** The arc between two readings, for the coloured bands. */
const arc = (from: number, to: number, r: number) => {
  const a = polar(from, r);
  const b = polar(to, r);
  const large = ((to - from) / MAX) * SWEEP > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
};

/** Where the needle points for a step: idle on the first, redline on the last. */
export const readingForStep = (step: number, total: number) =>
  IDLE + ((REDLINE - IDLE) * (Math.min(Math.max(step, 1), total) - 1)) / Math.max(total - 1, 1);

// Every half: the whole numbers are the main ticks, the halves the small ones.
const TICKS = Array.from({ length: MAX * 2 + 1 }, (_, i) => i / 2);

/**
 * The concentric lines inside the ticks, after the old Porsche VDO tachs:
 * rings over the same stretch of the scale, ending at the redline, with the
 * last stretch before it in red.
 */
const LINES = [34, 31.5, 29, 26.5, 24];
const LINES_FROM = 1; // the second tick
const LINES_RED = 6.2;

export default function Tachometer({ step, total, size = 60, style }: {
  /** 1-based. */
  step: number;
  total: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  // Starts at rest, on the first tick; a form reopened past step 1 sweeps up to it.
  const angle = useSharedValue(angleFor(0));
  useEffect(() => {
    angle.value = withSpring(angleFor(readingForStep(step, total)), {
      damping: 9, stiffness: 140, mass: 0.6,
    });
  }, [step, total, angle]);
  const needleStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: step }}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="tachFace" cx="50%" cy="45%" r="55%">
            <Stop offset="0%" stopColor="#161616" />
            <Stop offset="100%" stopColor="#050505" />
          </RadialGradient>
        </Defs>

        {/* The face — no bezel: the dial is the face, edge to edge. */}
        <Circle cx={50} cy={50} r={50} fill="url(#tachFace)" />


        {TICKS.map((v) => {
          const main = Number.isInteger(v);
          const a = polar(v, 43);
          const b = polar(v, main ? 36 : 39.5);
          return (
            <Line
              key={v}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={INK}
              strokeWidth={main ? 2.4 : 1.2}
            />
          );
        })}

        {LINES.map((r) => (
          <React.Fragment key={r}>
            <Path d={arc(LINES_FROM, LINES_RED, r)} stroke={INK} strokeWidth={0.9} fill="none" opacity={0.8} />
            {/* Thick enough that the red stretches close up into one block. */}
            <Path d={arc(LINES_RED, REDLINE, r)} stroke={RED} strokeWidth={2.6} fill="none" />
          </React.Fragment>
        ))}

      </Svg>

      {/* The needle, drawn pointing at 12 and turned into place. */}
      <Animated.View style={[StyleSheet.absoluteFill, needleStyle]} pointerEvents="none">
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Line x1={50} y1={60} x2={50} y2={10} stroke={INK} strokeWidth={3.2} strokeLinecap="round" />
          {/* The hub, over the needle's pivot. */}
          <Circle cx={50} cy={50} r={6} fill="#6B6B6B" />
        </Svg>
      </Animated.View>
    </View>
  );
}
