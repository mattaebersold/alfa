import React from 'react';
import { View, StyleSheet, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * The commit button, pinned to the bottom of a scrolling form.
 *
 * A long form's submit used to sit at the end of the scroll, so the way to post
 * was to keep scrolling until you found it. Here it is always in reach, over a
 * gradient that fades from nothing to the form's own ground: content passes
 * under it and dissolves rather than being cut off by a hard bar, which is what
 * keeps the button legible without walling off the page.
 *
 * `bottomInset` is the form's job, not this component's — a modal sheet, a
 * screen with a tab bar and a screen without one all need different clearance.
 */
export default function StickyFormFooter({
  children,
  /** The form's background — what the gradient resolves to. */
  color,
  bottomInset,
  style,
}: {
  children: React.ReactNode;
  color: string;
  bottomInset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pad = bottomInset ?? (Platform.OS === 'android' ? 28 : 20);

  return (
    <View style={[styles.wrap, { paddingBottom: pad }, style]} pointerEvents="box-none">
      <LinearGradient
        colors={['transparent', color + 'CC', color]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 14, paddingTop: 26,
  },
});
