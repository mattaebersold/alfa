import React from 'react';
import { View, StyleSheet } from 'react-native';
import FormScrollView from '../keyboard/FormScrollView';
import SharedModal from './ui/SharedModal';

/**
 * A bottom sheet with a title row — a thin wrapper over the app's one pane
 * (SharedModal), so it slides, scrims, drags and avoids the keyboard as every
 * other pane does. It keeps the X its callers had, and by default wraps the
 * body in a FormScrollView (which adds no keyboard space of its own inside a
 * pane — the pane has already shrunk for the keyboard).
 */
export default function Sheet({
  visible, onClose, title, children, scroll = true, heightRatio,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Wrap the body in a ScrollView. Off for bodies that scroll themselves. */
  scroll?: boolean;
  /** Pin the sheet to a fraction of the screen instead of sizing to content. */
  heightRatio?: number;
}) {
  return (
    <SharedModal visible={visible} onClose={onClose} title={title ?? ''} heightRatio={heightRatio} showClose>
      {scroll ? (
        <FormScrollView>{children}</FormScrollView>
      ) : (
        <View style={styles.fill}>{children}</View>
      )}
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
