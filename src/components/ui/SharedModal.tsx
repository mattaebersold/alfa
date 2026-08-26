import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Pressable,
  Platform, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import { useKeyboardInset } from '../../hooks/useKeyboardHeight';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Near-black surfaces — matches the car-detail pane look.
const SHEET_BG = '#161616';
const SHEET_HEADER_BG = '#000000';

// Android's bottom system UI (gesture bar / nav buttons) overlaps the sheet, so
// pad the bottom to keep content clear of it. iOS clearance is handled by the
// safe-area layout, so this is Android-only.
const SHEET_BOTTOM_PAD = Platform.OS === 'android' ? 60 : 30;

interface SharedModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /**
   * Custom header content in place of the plain `title` text — for headers that
   * need more than a string (an avatar plus a name, say).
   */
  titleContent?: React.ReactNode;
  /** Extra element rendered on the right of the header (before the close X). */
  headerRight?: React.ReactNode;
  /**
   * Fired once the close animation finishes and the underlying RN Modal has
   * unmounted. Use this to chain a follow-up modal (iOS can't present a new
   * modal until the current one has fully dismissed).
   */
  onDismissed?: () => void;
  /**
   * Fill the screen instead of sizing to content.
   *
   * Content-sized is right for a sheet you skim and dismiss, but wrong for one
   * you live in — a chat thread sized to its content opens at the 50% floor and
   * leaves its message list with no room to scroll.
   */
  fullHeight?: boolean;
  /**
   * Pin the sheet to a fraction of the screen (0–1) instead of sizing to
   * content. For a sheet whose contents vary wildly — a list that might hold
   * two rows or fifty — a stable height beats one that jumps per open.
   */
  heightRatio?: number;
  children: React.ReactNode;
}

/**
 * Shared bottom-sheet modal — near-black, blurred overlay, grows with content
 * between 50% and 90% of screen height, or fills the screen with `fullHeight`.
 * Convert other modals to this when asked to "use SharedModal". The caller
 * supplies the scrollable content as children.
 */
export default function SharedModal({ visible, onClose, title, titleContent, headerRight, onDismissed, fullHeight = false, heightRatio, children }: SharedModalProps) {
  const slideY = useRef(new Animated.Value(600)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(false);
  const [rendered, setRendered] = useState(false);
  const insets = useSafeAreaInsets();

  /**
   * Keyboard clearance. The sheet sits on the bottom of the screen, which is
   * exactly what the keyboard covers, so the inset needs no correction — the
   * whole stack is simply padded up by it. See useKeyboardInset for why this
   * isn't a KeyboardAvoidingView.
   */
  const { animated: keyboardPad, visible: keyboardUp } = useKeyboardInset();

  useEffect(() => {
    if (visible) {
      mountedRef.current = true;
      setRendered(true);
      slideY.setValue(600);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else if (mountedRef.current) {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 600, duration: 240, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        mountedRef.current = false;
        setRendered(false);
        onDismissed?.();
      });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rendered) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: keyboardPad }}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]} pointerEvents="none">
          <BlurView tint="dark" intensity={28} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
        </Animated.View>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            heightRatio
              ? [styles.sheetRatio, { height: `${Math.round(heightRatio * 100)}%` as const }]
              : fullHeight ? styles.sheetFull : styles.sheetSized,
            {
              // With the keyboard up this padding is dead space between the
              // content and the keyboard, so it collapses out of the way.
              paddingBottom: keyboardUp ? 0 : SHEET_BOTTOM_PAD,
              transform: [{ translateY: slideY }],
            },
          ]}
        >
          <View style={[
            styles.header,
            // A full-height sheet reaches the top of the screen, and this Modal
            // is status-bar-translucent — without this the header sits under the
            // clock. A sized sheet never gets up there.
            fullHeight && { paddingTop: insets.top + 14 },
          ]}>
            {titleContent ?? <Text style={styles.title} numberOfLines={1}>{title}</Text>}
            <View style={styles.headerRight}>
              {headerRight}
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <X size={22} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
          </View>
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: SHEET_BG,
    overflow: 'hidden',
  },
  sheetSized: {
    minHeight: SCREEN_HEIGHT * 0.5,
    maxHeight: '90%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  // Fills whatever the keyboard leaves, so the sheet shrinks rather than slides
  // and its own bottom bar stays on screen. No top radius — there's no edge for
  // it to round against.
  sheetFull: { flex: 1 },
  // Fixed fraction: keeps the sized sheet's rounded cap, drops its min/max so
  // the explicit height is the only thing driving it.
  sheetRatio: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: SHEET_HEADER_BG,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#000000',
  },
  title:       { flex: 1, fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
