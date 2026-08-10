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
}: {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
}) {
  if (uri) {
    return <Image source={{ uri }} style={style} contentFit={contentFit} transition={200} />;
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
