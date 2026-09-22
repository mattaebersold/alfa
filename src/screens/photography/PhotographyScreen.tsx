import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Platform,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import * as Location from 'expo-location';
import { Camera } from 'lucide-react-native';
import AppHeader from '../../components/ui/AppHeader';
import PhotoSpotSummaryModal from '../../components/photography/PhotoSpotSummaryModal';
import { useSpotMarkers } from '../../components/photography/useSpotMarkers';
import { useColors } from '../../hooks/useColors';
import { useAppSelector } from '../../store/store';
import { useGetPhotoSpotsQuery } from '../../api/apiService';
import { boundsFor, coordinateAt, type MapBounds } from '../../utils/routeGeometry';
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
/** Close enough to see the streets around you, far enough to see the pins. */
const HERE_ZOOM = 13;
/** How long a finger has to rest before it's a pin, not a pan. */
const DROP_PIN_MS = 450;

/**
 * How long the camera must sit still before the pins are re-fetched.
 *
 * Long enough that a flick-pan across a city is one request rather than forty,
 * short enough that letting go feels like it loaded immediately.
 */
const SETTLE_MS = 400;

export default function PhotographyScreen() {
  const colors = useColors();
  const nav = useNavigation<any>();
  const { userInfo } = useAppSelector((s) => s.auth);

  const tabBarHeight = useBottomTabBarHeight();

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [openSpotId, setOpenSpotId] = useState<string | null>(null);

  /**
   * Where the map is pointed.
   *
   * State, because it's set from two places: the member's location when the
   * screen opens, and nowhere else — panning is the map's own business and
   * isn't echoed back here, or every pan would fight a re-render. The latest
   * pan *is* tracked, in the ref below, because dropping a pin needs to know
   * what the finger was over.
   */
  const [camera, setCamera] = useState(DEFAULT_CAMERA);
  const liveCamera = useRef<{ lat: number; lng: number; zoom: number }>({
    lat: DEFAULT_CAMERA.coordinates.latitude,
    lng: DEFAULT_CAMERA.coordinates.longitude,
    zoom: DEFAULT_CAMERA.zoom,
  });

  /**
   * Open on the member, not on the whole country.
   *
   * The screen used to start zoomed out to the continental US every time, and
   * the first thing everyone did was pinch their way home. Same two-step as
   * the create screen: the last known fix first, because it's instant and
   * usually metres off, then a fresh one to correct it. Nothing is asked for
   * that hasn't already been granted — this never *requests* permission, it
   * only uses it if it's there, so a member who declined isn't nagged by a
   * map they only wanted to look at.
   */
  useEffect(() => {
    let cancelled = false;
    const go = (lat: number, lng: number) => {
      if (cancelled) return;
      setCamera({ coordinates: { latitude: lat, longitude: lng }, zoom: HERE_ZOOM });
      liveCamera.current = { lat, lng, zoom: HERE_ZOOM };
    };
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const cached = await Location.getLastKnownPositionAsync();
        if (cached) go(cached.coords.latitude, cached.coords.longitude);
        const here = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        go(here.coords.latitude, here.coords.longitude);
      } catch {
        // No fix — the country view is still a map.
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCameraMove = useCallback((e: { coordinates: any; zoom: number }) => {
    liveCamera.current = { lat: e.coordinates.latitude, lng: e.coordinates.longitude, zoom: e.zoom };
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

  useEffect(() => () => { if (settle.current) clearTimeout(settle.current); }, []);

  // Without bounds the server answers with the most recent spots, which is the
  // right thing to show while the map is still working out where it's pointed.
  const { data } = useGetPhotoSpotsQuery(bounds ?? {});

  const spots = data?.entries ?? [];
  const markers = useSpotMarkers(spots);

  const onMarkerClick = useCallback((marker: { id?: string }) => {
    if (marker.id) setOpenSpotId(marker.id);
  }, []);

  const mine = useMemo(
    () => spots.filter((s) => s.user_id === userInfo?.user_id).length,
    [spots, userInfo?.user_id],
  );

  /** Start a pin here: the create screen opens with the point already placed. */
  const dropPin = useCallback((point: { lat: number; lng: number }) => {
    nav.navigate('PhotoSpotCreate', { lat: point.lat, lng: point.lng });
  }, [nav]);

  /**
   * Press and hold on the map to drop a pin.
   *
   * Google Maps has a long-press of its own; Apple Maps, through expo-maps,
   * does not — and neither will say what coordinate a screen point is. So the
   * hold is caught above both maps by a gesture that runs alongside the map's
   * own pans and pinches, and the point is projected back through the camera
   * the last pan reported (see coordinateAt). Google's native event is used
   * where it exists, since it's the platform's own idea of a long press.
   */
  const holdToPin = useMemo(() => Gesture.LongPress()
    .minDuration(DROP_PIN_MS)
    .maxDistance(12)
    .runOnJS(true)
    .onStart((e) => {
      const cam = liveCamera.current;
      const point = coordinateAt(
        { lat: cam.lat, lng: cam.lng }, cam.zoom, size.width, size.height, e.x, e.y,
      );
      if (point) runOnJS(dropPin)(point);
    }), [size.width, size.height, dropPin]);

  const mapProps = {
    style: StyleSheet.absoluteFill,
    cameraPosition: camera,
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

      {/* No type filter for now. The chips took a row off the map and the
          colours already tell the types apart on the pins themselves. */}

      <View style={styles.mapWrap} onLayout={onLayout}>
        <GestureDetector gesture={holdToPin}>
          <View style={StyleSheet.absoluteFill}>
            {Platform.OS === 'ios'
              ? <AppleMaps.View {...mapProps} markers={markers as any} />
              : (
                <GoogleMaps.View
                  {...mapProps}
                  markers={markers as any}
                  uiSettings={{ zoomControlsEnabled: false, mapToolbarEnabled: false }}
                  onMapLongClick={(e) => {
                    const { latitude, longitude } = e.coordinates ?? {};
                    if (typeof latitude === 'number' && typeof longitude === 'number') {
                      dropPin({ lat: latitude, lng: longitude });
                    }
                  }}
                />
              )}
          </View>
        </GestureDetector>

        {/* Clear of the tab bar, which sits over the bottom of this screen. The
            map runs underneath it — that's fine for a map — but a button and a
            badge have to be reachable. */}
        {spots.length === 0 && (
          <View pointerEvents="none" style={[styles.emptyBadge, { bottom: tabBarHeight + 16 }]}>
            <Camera size={13} color="#FFFFFF" />
            <Text style={styles.emptyText}>No spots here yet — hold the map to drop one</Text>
          </View>
        )}

        {/* No button. Holding the map is the way to drop a pin — the one
            gesture says both "here" and "make one", where a button could
            only say the second and then ask where. The badge below teaches
            it when the map is empty. */}
      </View>

      <PhotoSpotSummaryModal
        spotId={openSpotId}
        onClose={() => setOpenSpotId(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head:  { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  title: { fontSize: 22, fontWeight: '800' },
  sub:   { fontSize: 13, marginTop: 2 },

  mapWrap: { flex: 1, overflow: 'hidden' },

  // `bottom` is set inline — it depends on the tab bar's measured height.
  emptyBadge: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  emptyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

});
