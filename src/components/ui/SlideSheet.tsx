import React, { useEffect, useRef, useState } from 'react';
import { View, Modal, Pressable, Animated, Easing, StyleSheet, Dimensions, type StyleProp, type ViewStyle } from 'react-native';
import { PANE_BG, PANE_SCRIM, PANE_OPEN_MS, PANE_OPEN_OVERSHOOT } from '../../constants/config';

/** How long the sheet takes to go back down, and the wash to fade. */
const CLOSE_MS = 240;
const SCRIM_IN_MS = 220;
const SCRIM_OUT_MS = 200;

/**
 * A pane that comes up from the bottom — the frame every hand-built sheet
 * shares, so they all arrive the same way SharedModal's do: the panes' light
 * grey wash fades in behind, and the sheet slides up over it, a touch past
 * its place and back (PANE_OPEN_OVERSHOOT). Closing runs the same in reverse,
 * and the sheet stays mounted until it has gone.
 *
 * The caller draws the sheet's own content and passes its look as
 * `sheetStyle` — corners, padding, a height; the ground is PANE_BG unless it
 * says otherwise. A tap on the wash calls `onClose`.
 */
export default function SlideSheet({ visible, onClose, onDismissed, sheetStyle, children }: {
  visible: boolean;
  onClose: () => void;
  /** Once it has slid away and unmounted. */
  onDismissed?: () => void;
  sheetStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const offscreen = Dimensions.get('window').height;
  const slideY = useRef(new Animated.Value(offscreen)).current;
  const scrim = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(visible);
  const mounted = useRef(false);

  useEffect(() => {
    if (visible) {
      mounted.current = true;
      setRendered(true);
      slideY.setValue(offscreen);
      scrim.setValue(0);
      Animated.parallel([
        Animated.timing(slideY, { toValue: 0, duration: PANE_OPEN_MS, easing: Easing.out(Easing.back(PANE_OPEN_OVERSHOOT)), useNativeDriver: true }),
        Animated.timing(scrim, { toValue: 1, duration: SCRIM_IN_MS, useNativeDriver: true }),
      ]).start();
    } else if (mounted.current) {
      Animated.parallel([
        Animated.timing(slideY, { toValue: offscreen, duration: CLOSE_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(scrim, { toValue: 0, duration: SCRIM_OUT_MS, useNativeDriver: true }),
      ]).start(() => {
        mounted.current = false;
        setRendered(false);
        onDismissed?.();
      });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rendered) return null;

  const ground = (StyleSheet.flatten(sheetStyle)?.backgroundColor as string | undefined) ?? PANE_BG;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: PANE_SCRIM, opacity: scrim }]} pointerEvents="none" />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.stack} pointerEvents="box-none">
        {/* The sheet's own colour under its foot, shown only while the
            opening overshoots — so the screen doesn't show through below a
            sheet risen a little past its place. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.overshootFill, { backgroundColor: ground, opacity: slideY.interpolate({ inputRange: [-1, 0, 1], outputRange: [1, 1, 0], extrapolate: 'clamp' }) }]}
        />
        <Animated.View style={[{ backgroundColor: PANE_BG }, sheetStyle, { transform: [{ translateY: slideY }] }]}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stack: { flex: 1, justifyContent: 'flex-end' },
  overshootFill: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 },
});
