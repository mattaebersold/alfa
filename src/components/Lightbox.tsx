import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Modal, FlatList, TouchableOpacity, StyleSheet, useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { Text } from '../theme/Text';
import { Image } from 'expo-image';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { imageUrl } from '../constants/appConfig';
import { FONT_INTER } from '../theme/fonts';

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

/**
 * One pinch-to-zoom photo. A lighter take on alfa's ZoomableImage: pinch and
 * double-tap to zoom, drag to look around while zoomed, and the pager stops
 * paging while a photo is zoomed so the drag moves the photo, not the page.
 */
function ZoomableImage({ uri, width, height, onZoomChange }: {
  uri: string; width: number; height: number; onZoomChange: (zoomed: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const clampPan = (s: number) => {
    'worklet';
    const maxX = ((s - 1) * width) / 2;
    const maxY = ((s - 1) * height) / 2;
    tx.value = Math.min(maxX, Math.max(-maxX, tx.value));
    ty.value = Math.min(maxY, Math.max(-maxY, ty.value));
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(0.8, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedScale.value = 1;
      } else {
        savedScale.value = scale.value;
        clampPan(scale.value);
      }
      savedX.value = tx.value;
      savedY.value = ty.value;
      runOnJS(onZoomChange)(savedScale.value > 1.01);
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .minPointers(1)
    .maxPointers(1)
    .manualActivation(true)
    .onTouchesMove((_e, state) => {
      // Only claim the drag when zoomed; otherwise it belongs to the pager.
      if (savedScale.value > 1.01) state.activate();
      else state.fail();
    })
    .onUpdate((e) => {
      tx.value = savedX.value + e.translationX;
      ty.value = savedY.value + e.translationY;
      clampPan(scale.value);
    })
    .onEnd(() => {
      savedX.value = tx.value;
      savedY.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const zoomIn = savedScale.value <= 1.01;
      const next = zoomIn ? DOUBLE_TAP_SCALE : 1;
      scale.value = withTiming(next);
      savedScale.value = next;
      tx.value = withTiming(0);
      ty.value = withTiming(0);
      savedX.value = 0;
      savedY.value = 0;
      runOnJS(onZoomChange)(zoomIn);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      <Animated.View style={[{ width, height }, style]}>
        <Image source={{ uri }} style={{ width, height }} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  );
}

/** Anything with a filename on the CDN — a gallery image, a photo-spot photo, a post's media. */
export interface LightboxImage { filename?: string }

/**
 * Full-screen viewer for a set of photos: swipe between them, pinch to zoom.
 *
 * A Modal of its own, so from inside a SummaryModal it must be rendered through
 * that panel's `stacked` prop — see "Stacking" there — or iOS won't present it.
 */
export default function Lightbox({ images, index, onClose }: {
  images: LightboxImage[];
  /** Which photo to open on; null means closed. */
  index: number | null;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(index ?? 0);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (index != null) {
      setPage(index);
      setZoomed(false);
    }
  }, [index]);

  const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }, [width]);

  return (
    <Modal visible={index != null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* A Modal is its own root on Android — gestures need their own root view. */}
      <GestureHandlerRootView style={styles.root}>
        {index != null && (
          <FlatList
            data={images}
            keyExtractor={(g, i) => g.filename ?? String(i)}
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed}
            initialScrollIndex={index}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumEnd}
            renderItem={({ item }) => {
              const uri = imageUrl(item.filename, 'full');
              return (
                <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
                  {uri ? <ZoomableImage uri={uri} width={width} height={height} onZoomChange={setZoomed} /> : null}
                </View>
              );
            }}
          />
        )}

        <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <Text style={styles.count}>{images.length > 1 ? `${page + 1} / ${images.length}` : ''}</Text>
          <TouchableOpacity style={styles.close} onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#000' },
  top: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  count: { color: '#FFFFFF', fontSize: 14, fontFamily: FONT_INTER.bold, fontVariant: ['tabular-nums'] },
  close: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
});
