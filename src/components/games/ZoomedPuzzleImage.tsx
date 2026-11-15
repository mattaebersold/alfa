import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { imageUrl } from '../../utils/image';
import { clamp01, GAME_INSET } from './game';

/**
 * A window onto the puzzle photo, zoomed in on the admin's focus point.
 *
 * The photo always covers the window centred, which is what every game pulls
 * back out to when it's over. Zoom scales that about the spot where the focus
 * lands in it — so the close-up is on the focus and the zoom-out ends on the
 * centred photo without a jump, and the window never slides off the photo.
 *
 * `scale` animates: a wrong guess backs out a step, a finished game to the
 * whole photo. The first render takes it as-is — nothing zooms on arrival.
 *
 * expo-image directly rather than ui/AppImage: the zoom needs the photo at
 * full resolution (no early resizing, no downscaling) or it magnifies a
 * screen-sized copy.
 */
export default function ZoomedPuzzleImage({
  image, focusX, focusY, scale, startScale, cut, duration = 600, style, blurRadius = 0, onReady,
}: {
  image: string | null | undefined;
  focusX: number;
  focusY: number;
  /** Already clamped by the caller — 1 is the whole photo. */
  scale: number;
  /** How far in the game started: each step out from it drifts toward the middle. */
  startScale?: number;
  /** Changing this cuts straight to the new look — no zoom, no fade. */
  cut?: string;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  /** Blur mode: how blurred the photo is. 0 for sharp. */
  blurRadius?: number;
  /** The photo is on screen — loaded, or failed to and won't be. The stopwatch's cue. */
  onReady?: () => void;
}) {
  /** The photo's own size, once loaded. */
  const [photo, setPhoto] = useState<{ w: number; h: number } | null>(null);
  /** The window's size, once laid out. */
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  /** Width over height, held within reason — no letterbox slivers. */
  const ratio = photo ? Math.min(2.5, Math.max(0.75, photo.w / photo.h)) : null;
  const focus = zoomOrigin(clamp01(focusX), clamp01(focusY), photo, box);
  const start = startScale ?? scale;
  const toFocus = start > 1 ? Math.min(1, Math.max(0, (scale - 1) / (start - 1))) : 1;
  const ox = finiteOr(50 + (focus.x - 50) * toFocus, 50);
  const oy = finiteOr(50 + (focus.y - 50) * toFocus, 50);

  const s = useSharedValue(scale);
  const originX = useSharedValue(ox);
  const originY = useSharedValue(oy);
  const lastCut = useRef(cut);
  const cutting = lastCut.current !== cut;

  useEffect(() => {
    if (lastCut.current !== cut) {
      lastCut.current = cut;
      s.value = scale;
      originX.value = ox;
      originY.value = oy;
      return;
    }
    const timing = { duration, easing: Easing.out(Easing.cubic) };
    s.value = withTiming(scale, timing);
    originX.value = withTiming(ox, timing);
    originY.value = withTiming(oy, timing);
  }, [scale, ox, oy, duration, cut, s, originX, originY]);

  // The origin rides in the animated style with its scale (set apart, the
  // photo drew nothing mid-game), as [x, y, z] with two places: RN's string
  // form rejects decimals and "3.5e-15%".
  const zoomed = useAnimatedStyle(() => ({
    transformOrigin: [`${originX.value.toFixed(2)}%`, `${originY.value.toFixed(2)}%`, 0],
    transform: [{ scale: s.value }],
  }));
  const uri = imageUrl(image, 'full') ?? undefined;

  return (
    <View
      style={[
        styles.window, style,
        // The photo's shape as a height for the width (5:4 until loaded) —
        // never an aspectRatio, which against a minHeight narrows the window.
        box ? { height: box.w / (ratio ?? NATURAL_FALLBACK) } : { aspectRatio: NATURAL_FALLBACK },
      ]}
      onLayout={(e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setBox((b) => (b && b.w === width && b.h === height ? b : { w: width, h: height }));
      }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, zoomed]}>
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="center"
          transition={cutting ? 0 : 150}
          allowDownscaling={false}
          enforceEarlyResizing={false}
          blurRadius={blurRadius}
          onLoad={(e) => {
            const { width, height } = e.source;
            if (width > 0 && height > 0) {
              setPhoto((p) => (p && p.w === width && p.h === height ? p : { w: width, h: height }));
            }
            onReady?.();
          }}
          // A photo that can't load mustn't hold the clock back for good.
          onError={() => onReady?.()}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
    </View>
  );
}

const finiteOr = (n: number, fallback: number) => (Number.isFinite(n) ? n : fallback);

/**
 * Where the focus lands in the window once the photo covers it centred, in
 * percent — kept inside the window. Until both sizes are known, the focus's
 * own share, which is exact whenever the photo isn't cropped.
 */
function zoomOrigin(
  fx: number, fy: number,
  photo: { w: number; h: number } | null, box: { w: number; h: number } | null,
): { x: number; y: number } {
  if (!photo || !box || !box.w || !box.h) return { x: fx * 100, y: fy * 100 };
  const k = Math.max(box.w / photo.w, box.h / photo.h);
  const w = photo.w * k;
  const h = photo.h * k;
  const x = clamp01(((box.w - w) / 2 + fx * w) / box.w);
  const y = clamp01(((box.h - h) / 2 + fy * h) / box.h);
  return { x: x * 100, y: y * 100 };
}

/** A window's shape before its photo is in: a little shorter than square. */
const NATURAL_FALLBACK = 5 / 4;

const styles = StyleSheet.create({
  window: { width: '100%', overflow: 'hidden', backgroundColor: GAME_INSET },
});
