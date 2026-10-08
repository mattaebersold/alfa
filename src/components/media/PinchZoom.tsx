import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withTiming, Easing,
} from 'react-native-reanimated';
import { Portal, usePortalHost } from '@ors/kit';

/** How far a pinch can take it. */
const MAX_SCALE = 5;
/** How long the photo takes to settle back once let go. */
const RETURN_MS = 220;

/**
 * Pinch a photo to look closer, in place — the way photos behave in every
 * other app on the phone.
 *
 * Two fingers on the photo and it grows from between them, and moves with
 * them: the point you pinched stays under your fingers however far apart they
 * go or wherever they drift. Let go and it settles back into the card. No tap,
 * no double tap, no viewer to open and close — the pinch is the whole gesture,
 * and a single finger still scrolls the feed past it.
 *
 * ## Drawn above everything while it's held
 *
 * The photo lives in a card that clips (rounded corners), in a list that
 * clips, under the next card down. Grown in place it would be cut off at the
 * card's edge, which is no closer look at all. So as the pinch starts, a copy
 * of the photo is drawn into the app's portal layer exactly over the
 * original, and it's the copy that grows — over the header, the tab bar and
 * the cards around it — with the page dimmed behind it. Back at rest, the
 * copy goes.
 *
 * The original takes the same transform underneath, clipped to its card. The
 * copy covers it once it's drawn; until then (a frame or so) the pinch is
 * already answering in place, so nothing waits on the copy.
 *
 * `children` are rendered twice while zooming — keep them a picture, not
 * something with state of its own.
 */
export default function PinchZoom({ children, style, enabled = true }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  enabled?: boolean;
}) {
  const host = usePortalHost();
  const frame = useRef<View>(null);
  /** Where the copy is drawn, in the portal layer's points. Null at rest. */
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const zooming = useRef(false);

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  /** The focal point the pinch started at, in the photo's own points. */
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  const active = useSharedValue(false);

  const begin = useCallback(() => {
    zooming.current = true;
    const target = frame.current;
    if (!target || !host?.layer.current) return;
    const layer = host.layer.current;
    target.measureInWindow((x, y, w, h) => {
      layer.measureInWindow((lx, ly) => {
        // Let go before the measurements came back.
        if (!zooming.current) return;
        setRect({ x: x - lx, y: y - ly, w, h });
      });
    });
  }, [host]);

  const end = useCallback(() => {
    zooming.current = false;
    setRect(null);
  }, []);

  const pinch = Gesture.Pinch()
    .enabled(enabled)
    .onStart((e) => {
      active.value = true;
      originX.value = e.focalX;
      originY.value = e.focalY;
      runOnJS(begin)();
    })
    .onUpdate((e) => {
      // One finger already up: the focal point jumps to the remaining finger,
      // and following it would fling the photo across the screen.
      if (e.numberOfPointers < 2) return;
      const s = Math.min(MAX_SCALE, Math.max(1, e.scale));
      const cx = width.value / 2;
      const cy = height.value / 2;
      scale.value = s;
      // Keep the point first pinched under the fingers' current midpoint:
      // scaled about the centre, it lands at c + (o - c)·s, so move it the rest.
      tx.value = e.focalX - cx - (originX.value - cx) * s;
      ty.value = e.focalY - cy - (originY.value - cy) * s;
    })
    .onFinalize(() => {
      if (!active.value) return;
      active.value = false;
      const timing = { duration: RETURN_MS, easing: Easing.out(Easing.cubic) };
      tx.value = withTiming(0, timing);
      ty.value = withTiming(0, timing);
      scale.value = withTiming(1, timing, (done) => {
        if (done) runOnJS(end)();
      });
    });

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: Math.min(0.7, (scale.value - 1) * 0.7),
  }));

  if (!enabled) return <View style={style}>{children}</View>;

  return (
    <GestureDetector gesture={pinch}>
      <View
        ref={frame}
        style={style}
        collapsable={false}
        onLayout={(e) => {
          width.value = e.nativeEvent.layout.width;
          height.value = e.nativeEvent.layout.height;
        }}
      >
        <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
          {children}
        </Animated.View>

        {rect && host ? (
          <Portal>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
              <Animated.View
                style={[{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h }, zoomStyle]}
              >
                {children}
              </Animated.View>
            </View>
          </Portal>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: '#000' },
});
