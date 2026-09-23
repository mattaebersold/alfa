import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Platform, TouchableOpacity, FlatList,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import * as Location from 'expo-location';
import { Camera, Map as MapIcon, List as ListIcon } from 'lucide-react-native';
import AppHeader from '../../components/ui/AppHeader';
import EmptyState from '../../components/ui/EmptyState';
import FilterSummaryRow, { FilterChoiceRow, type FilterPill } from '../../components/ui/FilterSummaryRow';
import LocationFilterRow, { NO_ZIP_NOTE, locationPill } from '../../components/ui/LocationFilterRow';
import PhotoSpotSummaryModal from '../../components/photography/PhotoSpotSummaryModal';
import PhotoSpotRow from '../../components/photography/PhotoSpotRow';
import { useLocationFilter, type LocationChoice } from '../../hooks/useLocationFilter';
import { PHOTO_SPOT_TYPES, spotTypeLabel, spotTypeColor } from '../../constants/photoSpots';
import { useSpotMarkers } from '../../components/photography/useSpotMarkers';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useGetPhotoSpotsQuery } from '../../api/apiService';
import type { PhotoSpot } from '../../types/api';
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

/**
 * The list view's page. The server's cap is 300; this is the most recent
 * pins, which is what a list of "what's out there" wants — a list scoped to
 * the map's viewport would change under you while the map isn't even showing.
 */
const LIST_LIMIT = 100;

type ViewMode = 'map' | 'list';

/** What the filter panel asks: where, and what kind of place. */
interface SpotFilters {
  choice: LocationChoice;
  radius: number;
  type: string | null;
}

/**
 * How far in to look when the map goes to the near-me centre: enough to see
 * the whole radius with a little around it.
 */
const zoomForRadius = (miles: number) => (miles <= 50 ? 8.5 : miles <= 100 ? 7.5 : 5);

export default function PhotographyScreen() {
  const colors = useColors();
  const brand = useBrandColor();
  const nav = useNavigation<any>();

  const tabBarHeight = useBottomTabBarHeight();

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [openSpotId, setOpenSpotId] = useState<string | null>(null);
  /**
   * Map or list. The map is the default and the feature; the list is the same
   * pins as rows, for reading rather than panning. Both open the same summary.
   */
  const [mode, setMode] = useState<ViewMode>('map');

  /**
   * Where, and what kind — the same Location filter events, members and cars
   * use, near me by default, with the spot's type beside it. Both views read
   * it: the map shows what's both on screen and within reach, the list what's
   * within reach.
   */
  const location = useLocationFilter();
  const [type, setType] = useState<string | null>(null);
  const where = useMemo(
    () => ({ ...location.params, ...(type ? { type } : {}) }),
    [location.params, type],
  );
  /** Set by an apply that changed near me, so the map goes to the new centre once. */
  const recenter = useRef(false);

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
   * The map itself, for moving the camera after it has mounted.
   *
   * `cameraPosition` is the *initial* position on both maps, and on Apple
   * Maps a later change to the prop does nothing — which is why iOS sat on
   * the whole continent while the location fix arrived a beat too late to
   * count. The state above still seeds a remount (switching back from the
   * list); this is how the live map is told to move.
   */
  const mapRef = useRef<AppleMaps.MapView | GoogleMaps.MapView | null>(null);

  /**
   * Open on the member, not on the whole country.
   *
   * The screen used to start zoomed out to the continental US every time, and
   * the first thing everyone did was pinch their way home. Same two-step as
   * the create screen: the last known fix first, because it's instant and
   * usually metres off, then a fresh one to correct it. Permission is asked
   * for once, the first time, if it has never been answered — a member who
   * has declined is never asked again, so a map they only wanted to look at
   * doesn't nag them.
   */
  useEffect(() => {
    let cancelled = false;
    const go = (lat: number, lng: number) => {
      if (cancelled) return;
      const next = { coordinates: { latitude: lat, longitude: lng }, zoom: HERE_ZOOM };
      setCamera(next);
      liveCamera.current = { lat, lng, zoom: HERE_ZOOM };
      // The mounted map won't follow the prop — see mapRef.
      mapRef.current?.setCameraPosition(next);
    };
    (async () => {
      let { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted' && canAskAgain) {
        ({ status } = await Location.requestForegroundPermissionsAsync());
      }
      if (status !== 'granted') return;

      /**
       * Apple Maps can centre on the member by itself: with no config, the
       * native camera setter asks MapKit for the user's location, which it
       * has the moment permission is granted — before expo-location has a
       * fix to hand over, and even when it never gets one. So on iOS the map
       * moves home straight away and the fixes below only refine the zoom.
       * Google's setter has no such mode.
       */
      if (Platform.OS === 'ios' && !cancelled) mapRef.current?.setCameraPosition();

      // The last fix first, because it's instant. Right after a fresh grant
      // there usually isn't one.
      try {
        const cached = await Location.getLastKnownPositionAsync();
        if (cached) go(cached.coords.latitude, cached.coords.longitude);
      } catch {
        // Nothing cached is the common case, not a failure.
      }

      /**
       * A fresh fix, but not forever: on a simulator with no location set,
       * or indoors on a phone, this can hang or throw, and either used to
       * leave the map on the continent with no word why. Ten seconds is
       * plenty for a phone; past it, whatever the map already shows stands.
       */
      try {
        const here = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), 10000)),
        ]);
        go(here.coords.latitude, here.coords.longitude);
      } catch (err) {
        console.warn('[photography] no location fix:', err);
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
  const { data } = useGetPhotoSpotsQuery({ ...(bounds ?? {}), ...where });

  const spots = data?.entries ?? [];
  const markers = useSpotMarkers(spots);

  // The list's own page, only fetched once the list is shown.
  const { data: listData, isLoading: listLoading } = useGetPhotoSpotsQuery(
    { limit: LIST_LIMIT, ...where },
    { skip: mode !== 'list' },
  );
  const listSpots = listData?.entries ?? [];

  // Near me with nothing to measure from (no saved zip) — show everything,
  // and the note under the row says why.
  const nearUnavailable = !!(data?.near_unavailable || listData?.near_unavailable);
  const { fallBack } = location;
  useEffect(() => {
    if (nearUnavailable) fallBack();
  }, [nearUnavailable, fallBack]);

  /**
   * After near me is chosen or its radius changed, the map goes to the zip
   * it measures from, zoomed to fit the radius. Once, on that apply — not on
   * every fetch, or panning away would be undone by the next response.
   */
  const center = data?.center ?? null;
  useEffect(() => {
    if (!recenter.current || !center || location.choice !== 'near') return;
    recenter.current = false;
    const next = {
      coordinates: { latitude: center.lat, longitude: center.lng },
      zoom: zoomForRadius(location.radius),
    };
    setCamera(next);
    liveCamera.current = { lat: center.lat, lng: center.lng, zoom: next.zoom };
    mapRef.current?.setCameraPosition(next);
  }, [center?.lat, center?.lng, location.choice, location.radius]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = useCallback((draft: SpotFilters) => {
    const nearChanged = draft.choice !== location.choice || draft.radius !== location.radius;
    if (draft.choice !== location.choice) location.choose(draft.choice);
    if (draft.radius !== location.radius) location.setRadius(draft.radius);
    setType(draft.type);
    if (draft.choice === 'near' && nearChanged) recenter.current = true;
  }, [location]);

  const pills: FilterPill[] = [
    locationPill(location.choice, location.radius),
    ...(type ? [{ key: 'type', label: spotTypeLabel(type) ?? type, color: spotTypeColor(type) }] : []),
  ];

  const onMarkerClick = useCallback((marker: { id?: string }) => {
    if (marker.id) setOpenSpotId(marker.id);
  }, []);

  const openRow = useCallback((spot: PhotoSpot) => setOpenSpotId(spot.internal_id), []);

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

      {/* The title, and beside it the switch between the map and the same
          pins as a list. No count line under the title: it said how many
          pins were in the viewport, which changed with every pan and told
          you nothing you couldn't see. */}
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.fg }]}>Photography</Text>
        <View style={[styles.toggle, { backgroundColor: colors.segment }]} accessibilityRole="tablist">
          {(['map', 'list'] as ViewMode[]).map((m) => {
            const active = mode === m;
            const Icon = m === 'map' ? MapIcon : ListIcon;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.toggleBtn, active && { backgroundColor: brand }]}
                onPress={() => setMode(m)}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={m === 'map' ? 'Map view' : 'List view'}
              >
                <Icon size={14} color={active ? '#000000' : colors.grey} strokeWidth={2.4} />
                <Text style={[styles.toggleText, { color: active ? '#000000' : colors.grey }]}>
                  {m === 'map' ? 'Map' : 'List'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* One row that opens a panel, as on events, members and cars — where,
          and what kind of place. A row rather than chips, which took a band
          off the map. */}
      <FilterSummaryRow<SpotFilters>
        value={{ choice: location.choice, radius: location.radius, type }}
        onApply={applyFilters}
        pills={pills}
        style={styles.filterRow}
      >
        {(draft, setDraft) => (
          <>
            <LocationFilterRow
              choice={draft.choice}
              onChoose={(choice) => setDraft((d) => ({ ...d, choice }))}
              radius={draft.radius}
              onRadius={(radius) => setDraft((d) => ({ ...d, radius }))}
            />
            <FilterChoiceRow
              label="Type"
              options={[
                { key: null as string | null, label: 'All' },
                ...PHOTO_SPOT_TYPES.map((t) => ({ key: t.key as string | null, label: t.label })),
              ]}
              selected={draft.type}
              onSelect={(next) => setDraft((d) => ({ ...d, type: next }))}
            />
          </>
        )}
      </FilterSummaryRow>
      {/* On the screen, not in the panel — it explains what's below. */}
      {location.fellBack && (
        <Text style={[styles.note, { color: colors.grey }]}>{NO_ZIP_NOTE}</Text>
      )}

      {mode === 'list' ? (
        <FlatList
          data={listSpots}
          keyExtractor={(spot) => spot.internal_id}
          renderItem={({ item }) => <PhotoSpotRow spot={item} onPress={openRow} />}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
          ListEmptyComponent={listLoading ? null : <EmptyState title="No spots pinned yet" />}
        />
      ) : (
      <View style={styles.mapWrap} onLayout={onLayout}>
        <GestureDetector gesture={holdToPin}>
          <View style={StyleSheet.absoluteFill}>
            {Platform.OS === 'ios'
              ? <AppleMaps.View ref={mapRef as any} {...mapProps} markers={markers as any} />
              : (
                <GoogleMaps.View
                  ref={mapRef as any}
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
      )}

      <PhotoSpotSummaryModal
        spotId={openSpotId}
        onClose={() => setOpenSpotId(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
  },
  title: { fontSize: 22, fontWeight: '800', flexShrink: 1 },
  filterRow: { marginHorizontal: 16, marginBottom: 10 },
  note: { fontSize: 12, lineHeight: 17, paddingHorizontal: 16, marginTop: -4, marginBottom: 10 },

  // Two segments in a pill; the live one is filled in the brand colour.
  toggle:     { flexDirection: 'row', padding: 3, borderRadius: 999, flexShrink: 0 },
  toggleBtn:  {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  toggleText: { fontSize: 12.5, fontWeight: '700' },

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
