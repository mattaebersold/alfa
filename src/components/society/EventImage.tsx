import React from 'react';
import { View, StyleSheet, type StyleProp, type ImageStyle } from 'react-native';
import { Image } from 'expo-image';

/**
 * An event's photo, with a shared stand-in for events that don't have one.
 *
 * The fallback is blurred and darkened so it reads as a backdrop rather than a
 * photo of the event itself — and so the badges and title overlaid on it stay
 * legible.
 */
export default function EventImage({
  uri,
  style,
  contentFit = 'cover',
  onAspectRatio,
}: {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
  /**
   * The photo's own width ÷ height, once it has decoded. Only fires for a real
   * photo — the fallback is a stand-in, so its shape shouldn't drive layout.
   */
  onAspectRatio?: (ratio: number) => void;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={style}
        contentFit={contentFit}
        transition={200}
        onLoad={onAspectRatio && (({ source }) => {
          if (source?.width && source?.height) onAspectRatio(source.width / source.height);
        })}
      />
    );
  }

  return (
    <>
      <Image
        source={require('../../../assets/event-image.jpg')}
        style={style}
        contentFit={contentFit}
        blurRadius={12}
      />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} pointerEvents="none" />
    </>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(0,0,0,0.55)' },
});
