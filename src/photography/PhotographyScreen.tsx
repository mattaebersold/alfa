import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, StyleSheet, Platform, TouchableOpacity, FlatList, Alert, type LayoutChangeEvent,
} from 'react-native';
import { Text } from '../theme/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import * as Location from 'expo-location';
import { Map as MapIcon, List as ListIcon, MapPin, X, ImagePlus, Plus, Minus, Camera } from 'lucide-react-native';
import { EmptyState } from '../components/Spinner';
import AddressField from '../components/AddressField';
import FilterSummaryRow, { FilterChoiceRow, FilterDivider, type FilterPill } from '../filters/FilterSummaryRow';
import LocationFilterRow, { NO_ZIP_NOTE, locationPill } from '../components/ui/LocationFilterRow';
import { useLocationFilter, useNearFallback, isNear, type LocationChoice } from '../hooks/useLocationFilter';
import NoResultsNear from '../components/ui/NoResultsNear';
import { useColors, useBrandColor, useBrandTextColor } from '../theme/useColors';
import { useGetPhotoSpotsQuery, useLazyGetPhotoSpotsQuery } from '../api/orsApi';
import type { PhotoSpot } from '../types/ors';
import PhotoSpotSummaryModal, { type PhotoSpotSummaryModalProps } from './PhotoSpotSummaryModal';
import PhotoSpotRow from './PhotoSpotRow';
import DropPinSheet, { type DropPoint } from './DropPinSheet';
import { PHOTO_SPOT_TYPES, spotTypeLabel, spotTypeColor } from './constants';
import { useSpotMarkers } from './useSpotMarkers';
import { useAddSpotPhotos } from './useAddSpotPhotos';
import { boundsFor, boxAround, coordinateAt, metersBetween, type MapBounds } from './geometry';
import { FONT_INTER } from '../theme/fonts'

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
 *
 * ## Hosting it
 *
 * alfa's PhotographyScreen, shared by alfa and the photo app. The screen knows
 * nothing about navigation: dropping a pin hands the point to `onDropPin`,
 * editing a spot hands its id to `onEditSpot`, and the host decides what
 * screen those open. `bottomInset` is the height of whatever sits over the
 * bottom of the screen (a floating tab bar), `header` is the host's own header
 * (alfa's AppHeader), and `focus` moves the map somewhere after it has mounted
 * — a gallery's "see on the map" link. What's tagged on a spot is the host's to
 * draw, through `renderSpotContext`.
 */

/** Where the map starts before it knows better — continental US. */
const DEFAULT_CAMERA = { coordinates: { latitude: 39.5, longitude: -98.35 }, zoom: 3 };
/** Close enough to see the streets around you, far enough to see the pins. */
const HERE_ZOOM = 13;
/** How long a finger has to rest before it's a pin, not a pan. */
const DROP_PIN_MS = 450;
/**
 * How close to an existing pin a new one can be before it's the same place —
 * about 30 metres, the width of a car park row. Mirrors horacio's
 * DUPLICATE_MILES; the server refuses too, this just says so before the form.
 */
const DUPLICATE_M = 30;
/** Close enough to see the address you searched for and the pin on it. */
const ADDRESS_ZOOM = 16;

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
  type: string | null;
}

/** How far the +/- buttons can take the map — the whole country to a single block. */
const MIN_ZOOM = 3;
const MAX_ZOOM = 20;

/**
 * How far in to look when the map goes to the near-me centre: enough to see
 * the whole radius with a little around it.
 */
const zoomForRadius = (miles: number) => (miles <= 50 ? 8.5 : miles <= 100 ? 7.5 : 5);

export interface MapFocus {
  lat: number;
  lng: number;
  zoom?: number;
  /** Open this spot's summary once the map is there. */
  spotId?: string;
}

export interface PhotographyScreenProps {
  /**
   * Start a new spot here. With `name`/`address` when the member chose a
   * named place (or searched an address) rather than the bare coordinate —
   * the form prefills from them.
   */
  onDropPin: (point: DropPoint) => void;
  /** The owner chose Edit on a spot's summary. No Edit button without it. */
  onEditSpot?: (spotId: string) => void;
  /** Space taken by a floating bar over the bottom of the screen. */
  bottomInset?: number;
  /**
   * Where the map's +/- sit, from the screen's bottom-left — for a host whose
   * bottom inset is an invisible strip, so they can come down to the bottom
   * edge, level with its own corner buttons. Defaults to just above
   * `bottomInset`.
   */
  zoomPosition?: { bottom: number; left: number };
  /** Heading beside the map/list toggle. */
  title?: string;
  /**
   * The side inset for the heading row, the search-and-filter row and the
   * note — the host app's gutter, so this lines up with its header. 16 when
   * the host doesn't say.
   */
  gutter?: number;
  /**
   * A line saying what the map is for, in place of the heading — for a host
   * whose own header already says where you are (alfa's home tab).
   */
  intro?: string;
  /** Anything the host wants above the heading (its own header). */
  header?: React.ReactNode;
  /** Pad for the status bar. Off when the host's header already does. */
  safeTop?: boolean;
  /** Move the map here. A new object is a new move. */
  focus?: MapFocus | null;
  /**
   * Drawn in a spot's summary, under its photos — who and what is tagged on
   * it. alfa passes its tag tiles; an app without tags leaves it out.
   */
  renderSpotContext?: (spotId: string) => React.ReactNode;
  /** The pinner's profile preview in a spot's summary — see PhotoSpotSummaryModal. */
  renderUserSummary?: PhotoSpotSummaryModalProps['renderUserSummary'];
  /**
   * Under the filter row when near me had no zip to measure from. Defaults to
   * alfa's wording, which points at Settings.
   */
  noZipNote?: string;
}

export default function PhotographyScreen({
  onDropPin, onEditSpot, bottomInset = 0, zoomPosition, title = 'Photography', intro, gutter = 16, header, safeTop = true, focus,
  renderSpotContext, renderUserSummary, noZipNote = NO_ZIP_NOTE,
}: PhotographyScreenProps) {
  const colors = useColors();
  const brand = useBrandColor();
  const brandText = useBrandTextColor();

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  /** The pins on screen, for the drop-pin check to read without re-creating it per fetch. */
  const spotsRef = useRef<PhotoSpot[]>([]);
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
   * State, because it's set from outside the map: the member's location when
   * the screen opens, near me's centre, the host's `focus` — panning is the
   * map's own business and isn't echoed back here, or every pan would fight a
   * re-render. The latest pan *is* tracked, in the ref below, because dropping
   * a pin needs to know what the finger was over.
   */
  const initial = focus
    ? { coordinates: { latitude: focus.lat, longitude: focus.lng }, zoom: focus.zoom ?? 15 }
    : DEFAULT_CAMERA;
  const [camera, setCamera] = useState(initial);
  const liveCamera = useRef<{ lat: number; lng: number; zoom: number }>({
    lat: initial.coordinates.latitude,
    lng: initial.coordinates.longitude,
    zoom: initial.zoom,
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
  /** Set once the host has pointed us somewhere, so the GPS doesn't undo it. */
  const focused = useRef(!!focus);
  /**
   * Whether the live map can be moved yet.
   *
   * Google Maps rejects `setCameraPosition` until it has loaded ("CameraUpdateFactory
   * is not initialized"), and the location fix often lands first. A move that
   * arrives early waits here and is applied from `onMapLoaded`. Apple Maps is
   * ready as soon as it mounts.
   */
  const mapLoaded = useRef(Platform.OS === 'ios');
  const pendingCamera = useRef<{ coordinates: { latitude: number; longitude: number }; zoom: number } | null>(null);

  const moveTo = useCallback((lat: number, lng: number, zoom: number) => {
    const next = { coordinates: { latitude: lat, longitude: lng }, zoom };
    setCamera(next);
    liveCamera.current = { lat, lng, zoom };
    // The mounted map won't follow the prop — see mapRef.
    if (mapLoaded.current) moveCamera(next);
    else pendingCamera.current = next;
  }, []);

  /**
   * The +/- buttons: a step in or out from wherever the map is now, keeping
   * its centre. From the live camera rather than state — state only catches
   * up once a pan settles.
   */
  const zoomBy = useCallback((step: number) => {
    const { lat, lng, zoom } = liveCamera.current;
    moveTo(lat, lng, Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + step)));
  }, [moveTo]);

  const onMapLoaded = useCallback(() => {
    mapLoaded.current = true;
    const waiting = pendingCamera.current;
    pendingCamera.current = null;
    if (waiting) moveCamera(waiting);
  }, []);

  /**
   * Move the live map. Google's setter is a promise that rejects when the next
   * move interrupts this one ("Animation cancelled") — the cached GPS fix and
   * then the fresh one do exactly that — and the rejection isn't an error.
   */
  function moveCamera(position: { coordinates: { latitude: number; longitude: number }; zoom: number }) {
    try {
      Promise.resolve(mapRef.current?.setCameraPosition(position as any)).catch(() => {});
    } catch {
      // The map isn't there yet; the position is already in state for its mount.
    }
  }

  /**
   * The host asked to look somewhere. Near me would hide the pin it's
   * pointing at if that's out of range, so the location widens to All.
   */
  const { choose } = location;
  const choiceRef = useRef(location.choice);
  choiceRef.current = location.choice;
  useEffect(() => {
    if (!focus || !Number.isFinite(focus.lat) || !Number.isFinite(focus.lng)) return;
    focused.current = true;
    setMode('map');
    if (isNear(choiceRef.current)) choose('all');
    moveTo(focus.lat, focus.lng, focus.zoom ?? 15);
    if (focus.spotId) setOpenSpotId(focus.spotId);
  }, [focus, moveTo, choose]);

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
      if (cancelled || focused.current) return;
      moveTo(lat, lng, HERE_ZOOM);
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
      if (Platform.OS === 'ios' && !cancelled && !focused.current) {
        try { Promise.resolve(mapRef.current?.setCameraPosition()).catch(() => {}); } catch { /* not mounted yet */ }
      }

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
  }, [moveTo]);

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
  spotsRef.current = spots;
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

  // Is anything near you at all? Asked on its own, by distance alone: the
  // map's query is cut to what's on screen, so its being empty only says the
  // view is. One spot answers it. Not once it's answered "nothing".
  const probeNear = isNear(location.choice) && !location.others;
  const { data: nearProbe, isFetching: probing } = useGetPhotoSpotsQuery(
    { limit: 1, ...location.params },
    { skip: !probeNear },
  );
  // Nothing pinned near you: the whole map, and in the list a "No results
  // near you" notice over every spot.
  useNearFallback(location, {
    settled: !!nearProbe && !probing && !nearProbe.near_unavailable,
    empty: (nearProbe?.entries?.length ?? 0) === 0,
  });

  /**
   * After near me is chosen or its radius changed, the map goes to the zip
   * it measures from, zoomed to fit the radius. Once, on that apply — not on
   * every fetch, or panning away would be undone by the next response.
   */
  const center = data?.center ?? null;
  useEffect(() => {
    if (!recenter.current || !center || !isNear(location.choice)) return;
    recenter.current = false;
    moveTo(center.lat, center.lng, zoomForRadius(location.radius));
  }, [center?.lat, center?.lng, location.choice, location.radius]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = useCallback((next: SpotFilters) => {
    const nearChanged = next.choice !== location.choice;
    if (next.choice !== location.choice) location.choose(next.choice);
    setType(next.type);
    // A new radius counts too: the map re-fits to it.
    if (isNear(next.choice) && nearChanged) recenter.current = true;
  }, [location]);

  // Where, and the type when there is one — both can be applied at once.
  const pills: FilterPill[] = [
    locationPill(location.choice),
    ...(type ? [{ key: 'type', label: spotTypeLabel(type) ?? type, color: spotTypeColor(type) }] : []),
  ];

  const onMarkerClick = useCallback((marker: { id?: string }) => {
    if (marker.id) setOpenSpotId(marker.id);
  }, []);

  const openRow = useCallback((spot: PhotoSpot) => setOpenSpotId(spot.internal_id), []);

  /**
   * The pin already at a point, if there is one.
   *
   * The pins on screen are checked first, because they're already here; a
   * point off-screen (an address that was searched for) asks the server for
   * the few metres around it. Nothing found — or the lookup failing — means
   * "go ahead": the server enforces this too.
   */
  const [findSpots] = useLazyGetPhotoSpotsQuery();
  const spotAt = useCallback(async (point: { lat: number; lng: number }): Promise<PhotoSpot | null> => {
    const near = (list: PhotoSpot[]) => list.find((s) => metersBetween(point, s) <= DUPLICATE_M) ?? null;
    const onScreen = near(spotsRef.current);
    if (onScreen) return onScreen;
    try {
      const { entries } = await findSpots(boxAround(point, 0.2)).unwrap();
      return near(entries ?? []);
    } catch {
      return null;
    }
  }, [findSpots]);

  /**
   * Start a pin here — the host opens its create screen with the point placed.
   * Unless there's a pin here already: one place, one pin, and what the member
   * wanted is to put their photos on it.
   */
  const dropPin = useCallback(async (point: DropPoint) => {
    const existing = await spotAt(point);
    if (!existing) {
      onDropPin(point);
      return;
    }
    Alert.alert(
      "There's already a pin here",
      undefined,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open it', onPress: () => setOpenSpotId(existing.internal_id) },
      ],
    );
  }, [onDropPin, spotAt]);

  /**
   * Searching an address goes there, rather than straight into a new pin: you
   * may be looking, not pinning. The map moves to the place and a card under
   * the search says where you searched — and whether it's pinned already.
   *
   * Pinned: the card offers the spot and "Add your photos" to it (one place,
   * one pin — see dropPin). Not pinned: it offers to pin it, which opens the
   * create screen on that point, photos and all.
   */
  const [address, setAddress] = useState('');
  const [searched, setSearched] = useState<{
    point: DropPoint;
    /** The pin within a few steps of it; undefined while that's being checked. */
    spot: PhotoSpot | null | undefined;
  } | null>(null);
  const goToAddress = useCallback(async (place: { lat?: number | null; lng?: number | null; name?: string | null; address?: string | null }) => {
    if (place.lat == null || place.lng == null) return;
    const point: DropPoint = {
      lat: place.lat, lng: place.lng, name: place.name ?? undefined, address: place.address ?? undefined,
    };
    setAddress('');
    // From the list, back to the map — that's where the place is.
    setMode('map');
    moveTo(point.lat, point.lng, ADDRESS_ZOOM);
    setSearched({ point, spot: undefined });
    const spot = await spotAt(point);
    // Only if it's still the search on show — a second one may have landed.
    setSearched((cur) => (cur && cur.point === point ? { point, spot } : cur));
  }, [moveTo, spotAt]);
  const { add: addSpotPhotos, adding: addingPhotos, canAdd: mayAddPhotos } = useAddSpotPhotos();

  /**
   * A held point doesn't become a pin straight away: the sheet asks whether
   * it's the exact spot or the place it's in. See DropPinSheet.
   */
  const [dropAt, setDropAt] = useState<{ lat: number; lng: number } | null>(null);

  /**
   * Press and hold on the map to drop a pin.
   *
   * Google Maps has a long-press of its own; Apple Maps, through expo-maps,
   * does not — and neither will say what coordinate a screen point is. So the
   * hold is caught above the map by a gesture that runs alongside the map's
   * own pans and pinches, and the point is projected back through the camera
   * the last pan reported (see coordinateAt). Google's native event is used
   * where it exists, since it's the platform's own idea of a long press — and
   * so the gesture is iOS-only, or an Android hold would drop the pin twice.
   */
  const holdToPin = useMemo(() => Gesture.LongPress()
    .enabled(Platform.OS === 'ios')
    .minDuration(DROP_PIN_MS)
    .maxDistance(12)
    .runOnJS(true)
    .onStart((e) => {
      const cam = liveCamera.current;
      const point = coordinateAt(
        { lat: cam.lat, lng: cam.lng }, cam.zoom, size.width, size.height, e.x, e.y,
      );
      if (point) setDropAt(point);
    }), [size.width, size.height]);

  const mapProps = {
    style: StyleSheet.absoluteFill,
    cameraPosition: camera,
    onMarkerClick,
    onCameraMove,
  };

  const Wrapper = safeTop ? SafeAreaView : View;

  /**
   * Where, and what kind of place — one panel either way. As a full row over
   * the list; on the map, where every point of height the controls take is
   * map you can't see, as a small button that just names what's applied
   * ("Near me"), tapped to change it.
   */
  const renderFilters = (compact: boolean) => (
    <FilterSummaryRow<SpotFilters>
      value={{ choice: location.choice, type }}
      onApply={applyFilters}
      pills={pills}
      compact={compact}
      style={compact ? styles.mapShadow : styles.filterRow}
    >
      {(draft, setDraft) => (
        <>
          <LocationFilterRow
            choice={draft.choice}
            onChoose={(choice) => setDraft((d) => ({ ...d, choice }))}
            allLabel="All spots"
            AllIcon={Camera}
          />
          {/* Unlabelled, ruled off like the location section above it. */}
          <View style={styles.typeGap}>
            <FilterChoiceRow
              options={[
                { key: null as string | null, label: 'All' },
                ...PHOTO_SPOT_TYPES.map((t) => ({ key: t.key as string | null, label: t.label })),
              ]}
              selected={draft.type}
              onSelect={(next) => setDraft((d) => ({ ...d, type: next }))}
            />
          </View>
          <FilterDivider last />
        </>
      )}
    </FilterSummaryRow>
  );

  /**
   * Search an address (to pin a spot there — the alternative to holding the
   * map) with the applied filter beside it. Floating over the top of the map,
   * or in the flow above the list; the same row either way.
   */
  const renderTools = (overMap: boolean) => (
    <View
      style={overMap
        ? [styles.mapTools, { left: gutter, right: gutter }]
        : [styles.listTools, { marginHorizontal: gutter }]}
      pointerEvents="box-none"
    >
    <View style={styles.toolsRow} pointerEvents="box-none">
      <AddressField
        value={address}
        onChangeText={setAddress}
        near={{ lat: liveCamera.current.lat, lng: liveCamera.current.lng }}
        placeholder="Search an address to pin a spot"
        onPlacePicked={goToAddress}
        floating
        style={styles.mapSearch}
        inputStyle={[styles.searchInput, { color: colors.fg, borderColor: colors.borderStrong, backgroundColor: colors.card }]}
      />
      {renderFilters(true)}
    </View>
    {overMap && searched && renderSearched(searched)}
    </View>
  );

  /** What you searched for, and what's there — see goToAddress. */
  const renderSearched = ({ point, spot }: NonNullable<typeof searched>) => {
    const place = point.name || point.address || 'This place';
    return (
      <View style={[styles.searched, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.searchedHead}>
          <MapPin size={15} color={brand} strokeWidth={2.4} />
          <View style={styles.searchedText}>
            <Text style={[styles.searchedPlace, { color: colors.fg }]} numberOfLines={1}>{place}</Text>
            {point.name && point.address ? (
              <Text style={[styles.searchedSub, { color: colors.grey }]} numberOfLines={1}>{point.address}</Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => setSearched(null)} hitSlop={10} accessibilityLabel="Close">
            <X size={16} color={colors.grey} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        {spot === undefined ? (
          <Text style={[styles.searchedSub, { color: colors.grey }]}>Checking for a pin here…</Text>
        ) : spot ? (
          <>
            <Text style={[styles.searchedSub, { color: colors.grey }]}>
              Already pinned: {spot.title || 'a spot'}
            </Text>
            <View style={styles.searchedActions}>
              <TouchableOpacity
                style={[styles.searchedBtn, { borderColor: colors.border }]}
                onPress={() => setOpenSpotId(spot.internal_id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.searchedBtnText, { color: colors.fg }]}>View spot</Text>
              </TouchableOpacity>
              {mayAddPhotos(spot) && (
                <TouchableOpacity
                  style={[styles.searchedBtn, { backgroundColor: brand, borderColor: brand }, addingPhotos && { opacity: 0.6 }]}
                  onPress={() => addSpotPhotos(spot)}
                  disabled={addingPhotos}
                  activeOpacity={0.85}
                >
                  <ImagePlus size={14} color="#000000" strokeWidth={2.4} />
                  <Text style={[styles.searchedBtnText, { color: '#000000' }]}>
                    {addingPhotos ? 'Uploading…' : 'Add your photos'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.searchedSub, { color: colors.grey }]}>No one has pinned this spot yet.</Text>
            <View style={styles.searchedActions}>
              <TouchableOpacity
                style={[styles.searchedBtn, { backgroundColor: brand, borderColor: brand }]}
                onPress={() => { setSearched(null); onDropPin(point); }}
                activeOpacity={0.85}
              >
                <MapPin size={14} color="#000000" strokeWidth={2.4} />
                <Text style={[styles.searchedBtnText, { color: '#000000' }]}>Pin it and add photos</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <Wrapper
      style={[styles.fill, { backgroundColor: colors.cream }]}
      {...(safeTop ? { edges: ['top'] as const } : {})}
    >
      {header}

      {/* The title, and beside it the switch between the map and the same
          pins as a list. No count line under the title: it said how many
          pins were in the viewport, which changed with every pan and told
          you nothing you couldn't see. */}
      <View style={[styles.head, { paddingHorizontal: gutter }]}>
        {intro
          ? <Text style={[styles.intro, { color: colors.grey }]}>{intro}</Text>
          : <Text style={[styles.title, { color: colors.fg }]}>{title}</Text>}
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
                <Icon size={14} color={active ? brandText : colors.grey} strokeWidth={2.4} />
                <Text style={[styles.toggleText, { color: active ? brandText : colors.grey }]}>
                  {m === 'map' ? 'Map' : 'List'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Above the list, the same search-and-filter row that floats over
          the map — so switching views doesn't move the controls around. */}
      {mode === 'list' && renderTools(false)}
      {/* On the screen, not in the panel — it explains what's below. */}
      {location.fellBack && (
        <Text style={[styles.note, { color: colors.grey, paddingHorizontal: gutter }]}>{noZipNote}</Text>
      )}


      {mode === 'list' ? (
        <FlatList
          data={listSpots}
          keyExtractor={(spot) => spot.internal_id}
          renderItem={({ item }) => <PhotoSpotRow spot={item} onPress={openRow} />}
          ListHeaderComponent={location.others ? <NoResultsNear radius={location.radius} style={{ marginTop: 8 }} /> : null}
          contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
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
                    onMapLoaded={onMapLoaded}
                    onMapLongClick={(e) => {
                      const { latitude, longitude } = e.coordinates ?? {};
                      if (typeof latitude === 'number' && typeof longitude === 'number') {
                        setDropAt({ lat: latitude, lng: longitude });
                      }
                    }}
                  />
                )}
            </View>
          </GestureDetector>

          {/* Over the top of the map rather than stacked above it: the search
              (type an address to pin a spot there — the alternative to holding
              the map) and the filter button share one floating row, so the map
              gets the height they used to take. The search's suggestions drop
              down over the map. */}
          {renderTools(true)}

          {/* Zoom, bottom left, for anyone who'd rather tap than pinch. */}
          <View style={[styles.zoom, styles.mapShadow, zoomPosition ?? { bottom: bottomInset + 16, left: 12 }]}>
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={() => zoomBy(1)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Zoom in"
            >
              <Plus size={18} color="#FFFFFF" strokeWidth={2.6} />
            </TouchableOpacity>
            <View style={styles.zoomRule} />
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={() => zoomBy(-1)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Zoom out"
            >
              <Minus size={18} color="#FFFFFF" strokeWidth={2.6} />
            </TouchableOpacity>
          </View>

          {/* No button. Holding the map is the way to drop a pin — the one
              gesture says both "here" and "make one", where a button could
              only say the second and then ask where. */}
        </View>
      )}

      <DropPinSheet point={dropAt} onClose={() => setDropAt(null)} onChoose={dropPin} />

      <PhotoSpotSummaryModal
        spotId={openSpotId}
        onClose={() => setOpenSpotId(null)}
        onEdit={onEditSpot}
        renderContext={renderSpotContext}
        renderUserSummary={renderUserSummary}
      />
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  typeGap: { paddingTop: 14 },
  fill: { flex: 1 },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
  },
  title: { fontSize: 22, fontFamily: FONT_INTER.bold, flexShrink: 1 },
  intro: { fontSize: 13, lineHeight: 18, flexShrink: 1 },
  filterRow: { marginHorizontal: 16, marginBottom: 10 },
  // The search and filter, side by side, in either container.
  // Above the searched card, so the search's suggestions drop down over it.
  // Constant, like AddressField's own — a zIndex that changes drops focus.
  toolsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, zIndex: 2, elevation: 2 },
  // The searched-for place, under the row.
  searched: {
    marginTop: 8, padding: 12, gap: 8,
    borderRadius: 16, borderWidth: 1,
    boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.35)',
  },
  searchedHead:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchedText:    { flex: 1, minWidth: 0 },
  searchedPlace:   { fontSize: 14, fontFamily: FONT_INTER.bold },
  searchedSub:     { fontSize: 12.5, lineHeight: 17 },
  searchedActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  searchedBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 999, borderWidth: 1,
  },
  searchedBtnText: { fontSize: 13, fontFamily: FONT_INTER.bold },
  // Above the list: the same row, in the flow — raised so the search's
  // suggestions draw over the rows below it.
  listTools: {
    marginHorizontal: 12, marginBottom: 10,
    zIndex: 10,
  },
  // The floating row on the map: search taking the width, the filter button
  // beside it. Raised so the search's suggestions draw over the map. Each
  // control is its own surface with a soft shadow, so it reads over any
  // map tile.
  mapTools: {
    position: 'absolute', top: 10, left: 12, right: 12,
    zIndex: 10,
  },
  // The filter button as a pill, with the search's shadow.
  mapShadow: { borderRadius: 22, boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.35)' },
  mapSearch: { flex: 1, borderRadius: 22, boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.35)' },
  // A pill, like the filter beside it.
  searchInput: {
    height: 44, borderWidth: 1, borderRadius: 22,
    paddingHorizontal: 16, fontSize: 14,
  },
  note: { fontSize: 12, lineHeight: 17, paddingHorizontal: 16, marginTop: -4, marginBottom: 10 },

  // Two segments in a pill; the live one is filled in the brand colour.
  toggle:     { flexDirection: 'row', padding: 3, borderRadius: 999, flexShrink: 0 },
  toggleBtn:  {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  toggleText: { fontSize: 12.5, fontFamily: FONT_INTER.bold },

  mapWrap: { flex: 1, overflow: 'hidden' },

  // Placed inline — it depends on the host's bottom inset. Dark
  // glass with the header buttons' white stroke, so it reads over any tile.
  zoom: {
    position: 'absolute', zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  zoomBtn:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  zoomRule: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.4)' },
});
