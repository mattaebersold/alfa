import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Pressable,
  KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Near-black surfaces — matches the car-detail pane look.
const SHEET_BG = '#161616';
const SHEET_HEADER_BG = '#000000';

// Android's bottom system UI (gesture bar / nav buttons) overlaps the sheet, so
// pad the bottom to keep content clear of it. iOS clearance is handled by the
// safe-area layout, so this is Android-only.
const ANDROID_BOTTOM_PAD = Platform.OS === 'android' ? 60 : 0;

interface SharedModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Extra element rendered on the right of the header (before the close X). */
  headerRight?: React.ReactNode;
  /**
   * Fired once the close animation finishes and the underlying RN Modal has
   * unmounted. Use this to chain a follow-up modal (iOS can't present a new
   * modal until the current one has fully dismissed).
   */
  onDismissed?: () => void;
  children: React.ReactNode;
}

/**
 * Shared bottom-sheet modal — near-black, blurred overlay, grows with content
 * between 50% and 90% of screen height. Convert other modals to this when asked
 * to "use SharedModal". The caller supplies the scrollable content as children.
 */
export default function SharedModal({ visible, onClose, title, headerRight, onDismissed, children }: SharedModalProps) {
  const slideY = useRef(new Animated.Value(600)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(false);
  const [rendered, setRendered] = useState(false);

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
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]} pointerEvents="none">
          <BlurView tint="dark" intensity={28} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
        </Animated.View>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.sheet, { paddingBottom: ANDROID_BOTTOM_PAD, transform: [{ translateY: slideY }] }]}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <View style={styles.headerRight}>
              {headerRight}
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <X size={22} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    minHeight: SCREEN_HEIGHT * 0.5,
    maxHeight: '90%',
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
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
