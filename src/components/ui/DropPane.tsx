import React, { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, Animated, Easing, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MODAL_BG, PANE_OPEN_MS, PANE_OPEN_OVERSHOOT } from '../../constants/config';

/** And to go back up — quicker, since a dismissal that lingers feels like it didn't take. */
const CLOSE_MS = 220;

/**
 * A full-height pane that comes down from the top of the screen, like a shade
 * pulled over it — and goes back up the way it came.
 *
 * Takes the same children as GrowPanel (`closeThen`, `expanded`, `fitHeight`),
 * so a panel's contents can sit in either. `fitHeight` does nothing here: the
 * pane is always the screen's height. The contents start below the status
 * bar; the close button is theirs to draw, top right.
 *
 * `closeThen(run)` closes and runs `run` once the pane has gone — navigation
 * belongs there, since iOS won't present a screen over a modal that's still
 * dismissing.
 */
export default function DropPane({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: (api: {
    closeThen: (run?: () => void) => void;
    expanded: boolean;
    fitHeight: (h: number) => void;
  }) => React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const screenH = Dimensions.get('window').height;
  /** 0 is up above the screen, 1 is down over it. */
  const drop = useRef(new Animated.Value(0)).current;
  const pending = useRef<(() => void) | null>(null);
  const [expanded, setExpanded] = React.useState(false);

  useEffect(() => {
    if (!visible) return;
    drop.setValue(0);
    setExpanded(false);
    Animated.timing(drop, {
      toValue: 1,
      duration: PANE_OPEN_MS,
      // Out, with a slight overshoot — down a touch past, then settled.
      easing: Easing.out(Easing.back(PANE_OPEN_OVERSHOOT)),
      useNativeDriver: true,
    }).start(({ finished }) => { if (finished) setExpanded(true); });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeThen = useCallback((run?: () => void) => {
    pending.current = run ?? null;
    setExpanded(false);
    Animated.timing(drop, {
      toValue: 0,
      duration: CLOSE_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      onClose();
      const go = pending.current;
      pending.current = null;
      go?.();
    });
  }, [onClose, drop]);

  const fitHeight = useCallback(() => {}, []);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => closeThen()} statusBarTranslucent>
      {/* The pane's colour above its top edge, for the moment the opening
          overshoots and drops it past its place. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.overshootFill, { opacity: drop.interpolate({ inputRange: [0.99, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }]}
      />
      <Animated.View
        style={[
          styles.pane,
          { paddingTop: insets.top, transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-screenH, 0] }) }] },
        ]}
      >
        <View style={styles.fill}>{children({ closeThen, expanded, fitHeight })}</View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Written out: spreading StyleSheet.absoluteFill yields {} on RN 0.86.
  // Pure black, as the summary modal is — not the panes' grey.
  pane: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: MODAL_BG },
  fill: { flex: 1 },
  overshootFill: { position: 'absolute', left: 0, right: 0, top: 0, height: 80, backgroundColor: MODAL_BG },
});
