import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { Plus, Camera } from 'lucide-react-native';
import AppHeader from '../../components/ui/AppHeader';
import PhotoSpotSummaryModal from '../../components/photography/PhotoSpotSummaryModal';
import { useSpotMarkers } from '../../components/photography/useSpotMarkers';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useAppSelector } from '../../store/store';
import { useGetPhotoSpotsQuery } from '../../api/apiService';
import { boundsFor, type MapBounds } from '../../utils/routeGeometry';
import { PHOTO_SPOT_TYPES, spotTypeColor } from '../../constants/photoSpots';
import { ss } from '../../styles/shared';

/**
 * Photography — a map of places worth shooting a car.
 *
 * The map *is* the feature. A spot is "this corner of this parking structure",
 * which no address or list view can say, so the screen opens on the map rather
 * than on a list of names you'd have to tap to place.
 *
 * ## What drives the query
 *
 * The pins shown are the pins inside the current viewport. expo-maps reports
 * its camera as a centre and a zoom, not as a rectangle, so the rectangle is
 * derived from that plus the measured size of the view — see `boundsFor`. The
 * camera is only committed to state once it settles, because `onCameraMove`
 * fires continuously through a pan and requesting on every frame would be a
 * request per pixel dragged.
 */

/** Where the map starts before it knows better — continental US. */
const DEFAULT_CAMERA = { coordinates: { latitude: 39.5, longitude: -98.35 }, zoom: 3 };

/**
 * How long the camera must sit still before the pins are re-fetched.
 *
 * Long enough that a flick-pan across a city is one request rather than forty,
 * short enough that letting go feels like it loaded immediately.
 */
const SETTLE_MS = 400;

export default function PhotographyScreen() {
  const colors = useColors();
  const brand = useBrandColor();
  const nav = useNavigation<any>();
  const { userInfo } = useAppSelector((s) => s.auth);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [openSpotId, setOpenSpotId] = useState<string | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height });
  };

  /**
   * The camera, once it has stopped moving.
   *
   * A plain timer rather than a gesture callback, because neither map reports
   * "the user let go" — only that the camera moved again. Each move cancels the
   * pending fetch and starts a new countdown, so the request goes out on the
   * first quiet moment after the pan.
   */
  const settle = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCameraMove = useCallback((e: { coordinates: any; zoom: number }) => {
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const next = boundsFor(
        { lat: e.coordinates.latitude, lng: e.coordinates.longitude },
        e.zoom,
        size.width,
        size.height,
      );
      if (next) setBounds(next);
    }, SETTLE_MS);
  }, [size.width, size.height]);

  React.useEffect(() => () => { if (settle.current) clearTimeout(settle.current); }, []);

  // Without bounds the server answers with the most recent spots, which is the
  // right thing to show while the map is still working out where it's pointed.
  const { data } = useGetPhotoSpotsQuery({
    ...(bounds ?? {}),
    ...(typeFilter ? { type: typeFilter } : {}),
  });

  const spots = data?.entries ?? [];
  const markers = useSpotMarkers(spots);

  const onMarkerClick = useCallback((marker: { id?: string }) => {
    if (marker.id) setOpenSpotId(marker.id);
  }, []);

  const mine = useMemo(
    () => spots.filter((s) => s.user_id === userInfo?.user_id).length,
    [spots, userInfo?.user_id],
  );

  const mapProps = {
    style: StyleSheet.absoluteFill,
    cameraPosition: DEFAULT_CAMERA,
    onMarkerClick,
    onCameraMove,
  };

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader spacer />

      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.fg }]}>Photography</Text>
        <Text style={[styles.sub, { color: colors.grey }]}>
          {spots.length} spot{spots.length === 1 ? '' : 's'} on the map
          {mine > 0 ? ` · ${mine} yours` : ''}
        </Text>
      </View>

      {/* Type filter. Chips rather than a picker: the whole list is short, and
          the colours here are the same ones the pins carry, which is what makes
          a filter chip readable as "the purple pins". */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
      >
        <Chip
          label="All"
          active={!typeFilter}
          color={colors.grey}
          onPress={() => setTypeFilter(null)}
        />
        {PHOTO_SPOT_TYPES.map((t) => (
          <Chip
            key={t.key}
            label={t.label}
            color={t.color}
            active={typeFilter === t.key}
            onPress={() => setTypeFilter(typeFilter === t.key ? null : t.key)}
          />
        ))}
      </ScrollView>

      <View style={styles.mapWrap} onLayout={onLayout}>
        {Platform.OS === 'ios'
          ? <AppleMaps.View {...mapProps} markers={markers as any} />
          : <GoogleMaps.View {...mapProps} markers={markers as any} uiSettings={{ zoomControlsEnabled: false, mapToolbarEnabled: false }} />}

        {spots.length === 0 && (
          <View pointerEvents="none" style={styles.emptyBadge}>
            <Camera size={13} color="#FFFFFF" />
            <Text style={styles.emptyText}>No spots here yet — drop the first one</Text>
          </View>
        )}
      </View>

      {/* The one action on the screen, so it floats over the map rather than
          competing with it in a toolbar. */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: brand }]}
        onPress={() => nav.navigate('PhotoSpotCreate')}
        activeOpacity={0.85}
        accessibilityLabel="Pin a photo spot"
      >
        <Plus size={18} color="#000000" />
        <Text style={styles.fabText}>Pin a spot</Text>
      </TouchableOpacity>

      <PhotoSpotSummaryModal
        spotId={openSpotId}
        onClose={() => setOpenSpotId(null)}
      />
    </SafeAreaView>
  );
}

function Chip({ label, color, active, onPress }: {
  label: string; color: string; active: boolean; onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.chip,
        { borderColor: active ? color : colors.border, backgroundColor: active ? color : 'transparent' },
      ]}
    >
      {/* The dot ties the chip to the pin colour even when the chip is off. */}
      {!active && <View style={[styles.chipDot, { backgroundColor: color }]} />}
      <Text style={[styles.chipText, { color: active ? '#FFFFFF' : colors.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  head:  { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  title: { fontSize: 22, fontWeight: '800' },
  sub:   { fontSize: 13, marginTop: 2 },

  // flexGrow: 0 or the row takes the leftover column height and the chips
  // stretch to fill it — the same trap the search filters fell into.
  chipRow:        { flexGrow: 0, marginBottom: 8 },
  chipRowContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, height: 32, borderRadius: 999, borderWidth: 1,
  },
  chipDot:  { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 13, fontWeight: '700' },

  mapWrap: { flex: 1, overflow: 'hidden' },

  emptyBadge: {
    position: 'absolute', left: 16, right: 16, bottom: 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  emptyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  fab: {
    position: 'absolute', right: 16, bottom: 28,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  fabText: { fontSize: 14, fontWeight: '800', color: '#000000' },
});
