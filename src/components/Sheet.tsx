import React from 'react';
import {
  View, StyleSheet, TouchableOpacity, Modal, Pressable,
} from 'react-native';
import { Text } from '../theme/Text';
import Animated from 'react-native-reanimated';
import { useKeyboardPadding } from '../keyboard/useKeyboardPadding';
import KeyboardAvoidingView from '../keyboard/KeyboardAvoidingView';
import FormScrollView from '../keyboard/FormScrollView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useColors } from '../theme/useColors';
import { PortalHost } from './Portal';
import { FONT_INTER } from '../theme/fonts'

/**
 * A bottom sheet on alfa's near-black ground.
 *
 * A lighter cousin of alfa's SharedModal: no drag-to-dismiss, which needs the
 * pan machinery that screen carries, but the same surface, header and tap-out
 * to close, so a sheet in one app reads like a sheet in another.
 *
 * With the keyboard up the whole sheet rides on top of it — a short sheet
 * would otherwise be entirely behind it — and a tall one scrolls whichever
 * field you're in into view (FormScrollView).
 */
const SHEET_BG = '#161616'; // alfa's SURFACE_DARK — panes share the app's ground

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
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // On the keyboard, the home indicator's clearance would only be a gap —
  // eased out as the keyboard rises, not switched (see useKeyboardPadding).
  const bottomPad = useKeyboardPadding({ closed: insets.bottom + 8, open: 8 });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {/* A Modal is its own window: floating lists need a layer inside it. */}
      <PortalHost>
      <Pressable style={styles.backdrop} onPress={onClose} />
      {/* In flow at the foot of the avoiding view, not absolutely positioned:
          an absolute `bottom: 0` ignores the keyboard padding, and the sheet
          would stay put behind the keyboard. box-none so taps above the sheet
          reach the backdrop. */}
      <KeyboardAvoidingView style={styles.stack} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            bottomPad,
            heightRatio ? { height: `${Math.round(heightRatio * 100)}%` } : { maxHeight: '90%' },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: colors.borderStrong }]}>
            <View style={styles.grabber} />
            <Text style={[styles.title, { color: colors.fg }]} numberOfLines={1}>{title ?? ''}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={20} color={colors.grey} />
            </TouchableOpacity>
          </View>
          {scroll ? (
            <FormScrollView>{children}</FormScrollView>
          ) : (
            <View style={styles.fill}>{children}</View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
      </PortalHost>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  stack: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  grabber: {
    position: 'absolute', top: 6, alignSelf: 'center', left: '50%', marginLeft: -18,
    width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)',
  },
  title: { fontSize: 16, fontFamily: FONT_INTER.bold, flex: 1, marginRight: 12 },
});
