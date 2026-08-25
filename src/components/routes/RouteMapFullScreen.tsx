import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import RouteMap, { type LatLng } from './RouteMap';

/**
 * The route's map, filling the screen.
 *
 * Inline, the map is a thumbnail: it sits in a scrolling page, so it can't own
 * the drag gesture, and at that size a hundred miles of road is a squiggle.
 * Here it's the only thing on screen, which is what makes panning and zooming
 * into a particular corner possible at all.
 *
 * A modal rather than a pushed screen — this is a closer look at what you're
 * already reading, not somewhere else to be.
 */
export default function RouteMapFullScreen({
  visible,
  onClose,
  path,
  speeds,
  markers,
  color,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  path: LatLng[];
  speeds?: number[];
  markers?: { lat: number; lng: number; label?: string }[];
  color: string;
  title?: string | null;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      // The map draws to every edge, including under the status bar.
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.fill}>
        {visible && path.length >= 2 && (
          // Mounted only while open: a native map view left alive behind a
          // closed modal keeps holding the camera and the location stack.
          <RouteMap
            path={path}
            speeds={speeds}
            markers={markers}
            color={color}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* The controls sit on the map, so they need their own ground. */}
        <LinearGradient
          colors={['rgba(0,0,0,0.65)', 'transparent']}
          style={[styles.scrim, { height: insets.top + 76 }]}
          pointerEvents="none"
        />

        <View style={[styles.bar, { top: insets.top + (Platform.OS === 'android' ? 10 : 6) }]}>
          {title ? (
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          ) : <View style={styles.fill} />}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close the map"
          >
            <X size={22} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill:  { flex: 1, backgroundColor: '#0A0A0A' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  bar: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  title: {
    flex: 1, fontSize: 16, fontWeight: '800', color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
});
