import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View, StyleProp, ViewStyle, ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';

// Fisher–Yates shuffle (returns a new array).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Props {
  /** Images to cycle through, in order. */
  sources: ImageSourcePropType[];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** How long each image is held before crossfading (ms). */
  interval?: number;
  /** Crossfade duration (ms). */
  fadeDuration?: number;
  /** Extra dark overlay applied on Android only (its background images read brighter). */
  androidOverlayColor?: string;
}

/**
 * Full-bleed background that crossfades between a set of images on a loop.
 * Drop-in replacement for <ImageBackground> (cover fit, children render on top).
 *
 * Uses expo-image, whose `transition` prop crossfades automatically when the
 * source changes — so we just cycle the index on a timer.
 */
export default function CrossfadeBackground({
  sources, style, children, interval = 6000, fadeDuration = 2800,
  androidOverlayColor = 'rgba(0,0,0,0.35)',
}: Props) {
  // Randomize the order once per mount, so each visit starts differently.
  const order = useMemo(() => shuffle(sources), [sources]);
  const [index, setIndex] = useState(0);
  // The first image shows instantly (no fade-in); only subsequent swaps crossfade.
  const [primed, setPrimed] = useState(false);

  useEffect(() => {
    if (order.length <= 1) return;
    const id = setInterval(() => {
      setPrimed(true);
      setIndex((i) => (i + 1) % order.length);
    }, interval);
    return () => clearInterval(id);
  }, [order.length, interval]);

  return (
    <View style={[styles.container, style]}>
      {order.length > 0 && (
        <Image
          source={order[index]}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={primed ? fadeDuration : 0}
          cachePolicy="memory-disk"
        />
      )}
      {Platform.OS === 'android' && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: androidOverlayColor }]} pointerEvents="none" />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // Black base so any load gap reads as a dark splash, not a white flash.
  container: { flex: 1, backgroundColor: '#000' },
});
