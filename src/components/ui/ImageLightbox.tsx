import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming, withSpring, runOnJS,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Past this, the image is "zoomed" — the pager stops and the pan moves it. */
const ZOOM_THRESHOLD = 1.01;
const MIN_SCALE = 1;
const MAX_SCALE = 6;
/** How far a downward flick has to travel before it closes. */
const DISMISS_DISTANCE = 110;
/** Where a double-tap lands you. */
const DOUBLE_TAP_SCALE = 2.5;

export interface ZoomableImageProps {
  uri: string;
  width: number;
  height: number;
  /** Lets the pager know to stop scrolling while this page is zoomed. */
  onZoomChange: (zoomed: boolean) => void;
  /**
   * Dismiss on a downward flick. Omit where the viewer has its own chrome and
   * a close button of its own — the car galleries do — and the drag then does
   * nothing until the image is zoomed in.
   */
  onRequestClose?: () => void;
  /** Drives the backdrop's fade as the image is dragged away. */
  onDragProgress?: (progress: number) => void;
}

/**
 * One pinch-and-pan image.
 *
 * ## What was wrong with the previous version
 *
 * It zoomed, and it technically panned, but looking around a zoomed photo
 * didn't work — for three reasons that compound:
 *
 * 1. **Pinch was anchored to the centre.** Scale was applied about the view's
 *    midpoint regardless of where your fingers were, so pinching on a detail in
 *    the corner magnified the middle of the photo and pushed the thing you were
 *    looking at further off screen.
 * 2. **Pan was unbounded.** Nothing stopped a drag from flinging the image into
 *    the void, and once it was out there the only way back was a double-tap
 *    reset. Combined with (1), the usual experience was zooming in and having
 *    the picture disappear.
 * 3. **Pan tracked during the pinch.** A two-finger gesture feeds the Pan
 *    handler its centroid, so lifting one finger left `savedX/savedY` holding
 *    the accumulated two-finger travel, and the next one-finger drag jumped.
 *
 * ## What it does now
 *
 * Pinch is focal: the point under your fingers stays under your fingers, which
 * is the whole grammar of zooming into a photo. Translation is clamped to the
 * image's own edges every frame, so the picture can never leave the screen and
 * a drag simply stops when you reach the edge. And the pan is measured from
 * where the *last* drag ended rather than accumulating across gestures, so
 * changing finger count doesn't jump.
 *
 * The bounds are computed from the displayed image rect, not the container.
 * A `contain`-fitted photo is letterboxed — a wide panorama in a tall window
 * has black above and below it — and clamping to the container would let you
 * drag the picture until only the letterboxing was on screen.
 *
 * Zoomed out, a vertical drag throws it away — the standard photo-viewer
 * dismissal. Zoomed in, the same drag moves the image, because at that point
 * you're looking at a detail and every gesture should be about getting to it.
 */
export function ZoomableImage({
  uri, width, height, onZoomChange, onRequestClose, onDragProgress,
}: ZoomableImageProps) {
  // Worklets can't call an undefined callback, so the optional props get
  // no-op stand-ins rather than a conditional at every call site.
  const requestClose = onRequestClose ?? (() => {});
  const reportDrag = onDragProgress ?? (() => {});
  const dismissable = !!onRequestClose;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  /**
   * The photo's displayed size, once `contain` has fitted it.
   *
   * Starts as the container and is corrected on load. Until the real
   * proportions arrive the bounds are merely conservative, never wrong in a way
   * that loses the picture.
   */
  const fitW = useSharedValue(width);
  const fitH = useSharedValue(height);

  const onLoad = useCallback((e: { source?: { width?: number; height?: number } }) => {
    const iw = e.source?.width;
    const ih = e.source?.height;
    if (!iw || !ih) return;
    const fit = Math.min(width / iw, height / ih);
    fitW.value = iw * fit;
    fitH.value = ih * fit;
  }, [width, height, fitW, fitH]);

  /** How far the image may travel from centre at the current scale. */
  const maxOffset = (k: number) => {
    'worklet';
    return {
      x: Math.max(0, (fitW.value * k - width) / 2),
      y: Math.max(0, (fitH.value * k - height) / 2),
    };
  };

  const clampToBounds = (k: number) => {
    'worklet';
    const max = maxOffset(k);
    translateX.value = Math.min(Math.max(translateX.value, -max.x), max.x);
    translateY.value = Math.min(Math.max(translateY.value, -max.y), max.y);
  };

  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedX.value = 0;
    savedY.value = 0;
    runOnJS(onZoomChange)(false);
    runOnJS(reportDrag)(0);
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    })
    .onUpdate((e) => {
      const next = Math.min(Math.max(savedScale.value * e.scale, 0.6), MAX_SCALE);

      /**
       * Keep the point under the fingers under the fingers.
       *
       * The focal point arrives in container coordinates; shifted to be
       * relative to the centre it becomes the fixed point of the scale, and
       * the translation that holds it still is the old translation scaled
       * about it.
       */
      const focalX = e.focalX - width / 2;
      const focalY = e.focalY - height / 2;
      const ratio = next / savedScale.value;
      translateX.value = focalX - (focalX - savedX.value) * ratio;
      translateY.value = focalY - (focalY - savedY.value) * ratio;

      scale.value = next;
      clampToBounds(next);
    })
    .onEnd(() => {
      // Anything at or below 1:1 springs back to fit rather than being left
      // slightly small or slightly off-centre.
      if (scale.value <= MIN_SCALE) {
        reset();
        return;
      }
      savedScale.value = scale.value;
      // Settle inside the bounds rather than snapping — an over-pinch that
      // pushed past an edge eases back to it.
      const max = maxOffset(scale.value);
      translateX.value = withSpring(Math.min(Math.max(translateX.value, -max.x), max.x), { damping: 20 });
      translateY.value = withSpring(Math.min(Math.max(translateY.value, -max.y), max.y), { damping: 20 });
      savedX.value = translateX.value;
      savedY.value = translateY.value;
      runOnJS(onZoomChange)(true);
    });

  const pan = Gesture.Pan()
    // One finger only. During a pinch the Pan handler is fed the two-finger
    // centroid, and letting that through is what made the next drag jump.
    .maxPointers(1)
    .onStart(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    })
    .onUpdate((e) => {
      if (scale.value > ZOOM_THRESHOLD) {
        translateX.value = savedX.value + e.translationX;
        translateY.value = savedY.value + e.translationY;
        clampToBounds(scale.value);
      } else {
        // Fit-to-screen: the drag is a dismissal, so it only tracks vertically
        // and the backdrop thins out as it goes.
        translateY.value = e.translationY;
        runOnJS(reportDrag)(Math.min(Math.abs(e.translationY) / (DISMISS_DISTANCE * 2), 1));
      }
    })
    .onEnd((e) => {
      if (scale.value > ZOOM_THRESHOLD) {
        savedX.value = translateX.value;
        savedY.value = translateY.value;
        return;
      }
      if (dismissable && (Math.abs(e.translationY) > DISMISS_DISTANCE || Math.abs(e.velocityY) > 800)) {
        runOnJS(requestClose)();
      } else {
        translateY.value = withSpring(0);
        runOnJS(reportDrag)(0);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.value > ZOOM_THRESHOLD) {
        reset();
        return;
      }
      // Zoom toward the tap, for the same reason the pinch is focal: you tap
      // the thing you want to see, not the middle of the screen.
      const focalX = e.x - width / 2;
      const focalY = e.y - height / 2;
      const tx = -focalX * (DOUBLE_TAP_SCALE - 1);
      const ty = -focalY * (DOUBLE_TAP_SCALE - 1);
      const max = maxOffset(DOUBLE_TAP_SCALE);

      const clampedX = Math.min(Math.max(tx, -max.x), max.x);
      const clampedY = Math.min(Math.max(ty, -max.y), max.y);

      scale.value = withTiming(DOUBLE_TAP_SCALE);
      translateX.value = withTiming(clampedX);
      translateY.value = withTiming(clampedY);
      savedScale.value = DOUBLE_TAP_SCALE;
      savedX.value = clampedX;
      savedY.value = clampedY;
      runOnJS(onZoomChange)(true);
    });

  // Pinch and pan run together so you can reframe mid-zoom; the double tap is
  // exclusive so it doesn't also register as the start of a drag.
  const gesture = Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height }, styles.page, animatedStyle]}>
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          // The whole point of the viewer: the photo at its own proportions,
          // not cropped to the shape of the card it was tapped from.
          contentFit="contain"
          transition={150}
          onLoad={onLoad}
        />
      </Animated.View>
    </GestureDetector>
  );
}

export interface ImageLightboxProps {
  /** Fully-qualified image URLs, in gallery order. */
  images: string[];
  /** Which one to open on. */
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}

/**
 * Full-screen photo viewer: pinch to zoom, drag to pan, double-tap to zoom in
 * and out, swipe sideways through the gallery, swipe down to dismiss.
 *
 * The one place in the app that shows a photo at its natural proportions —
 * everywhere else crops to a card, which is what this exists to escape.
 */
export default function ImageLightbox({
  images, initialIndex = 0, visible, onClose,
}: ImageLightboxProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const backdropOpacity = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      setZoomed(false);
      backdropOpacity.value = 1;
    }
  }, [visible, initialIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // The initial page can't be set until the scroll view has been laid out.
  const handleLayout = useCallback(() => {
    if (initialIndex > 0) {
      scrollRef.current?.scrollTo({ x: initialIndex * width, animated: false });
    }
  }, [initialIndex, width]);

  const handleDragProgress = useCallback((progress: number) => {
    backdropOpacity.value = 1 - progress;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  if (!visible || images.length === 0) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* Its own root: a Modal renders in a separate host view on Android, and
          gestures inside one are dead without a provider of their own. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          // A zoomed image owns the horizontal drag — otherwise panning across
          // a detail flicks to the next photo instead.
          scrollEnabled={!zoomed && images.length > 1}
          showsHorizontalScrollIndicator={false}
          onLayout={handleLayout}
          onMomentumScrollEnd={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
          }
        >
          {images.map((uri, i) => (
            <ZoomableImage
              key={`${uri}_${i}`}
              uri={uri}
              width={width}
              height={height}
              onZoomChange={setZoomed}
              onRequestClose={onClose}
              onDragProgress={handleDragProgress}
            />
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 8 }]}
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
        >
          <X size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {images.length > 1 && (
          <View style={[styles.counter, { bottom: insets.bottom + 20 }]}>
            <Text style={styles.counterText}>{index + 1} / {images.length}</Text>
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1 },
  // Near-black rather than black: a hair of the screen behind it reads as a
  // layer over the app instead of the app having been replaced.
  backdrop: { backgroundColor: 'rgba(0,0,0,0.96)' },
  page:     { alignItems: 'center', justifyContent: 'center' },
  closeBtn: {
    position: 'absolute', right: 14,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  counter:  {
    position: 'absolute', alignSelf: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  counterText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
