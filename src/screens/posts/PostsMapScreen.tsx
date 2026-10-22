import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, StyleSheet, Platform, TouchableOpacity, ScrollView, Dimensions, Alert, Linking, type LayoutChangeEvent,
} from 'react-native';
import { Text, AddressField, FilterSummaryRow, FilterChoiceRow, FilterDivider, type FilterPill } from '@ors/kit';
import { boundsFor, type MapBounds } from '@ors/kit/src/photography';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import * as Location from 'expo-location';
import { ChevronLeft, Plus, Minus, LocateFixed, MapPin } from 'lucide-react-native';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import { type SummaryOrigin } from '../../components/ui/SummaryModal';
import PostSummaryModal from '../../components/social/PostSummaryModal';
import { PlacePostRow } from '../../components/social/PlacePostsModal';
import { useGetPostMapPlacesQuery, useGetPostsQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { COMMON_RADIUS, COLOR_BLACK, COLOR_WHITE, GUTTER } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import type { Post, PostMapPlace, PostMapParams } from '../../types/api';

/**
 * Posts Map — where posts were made, as pins.
 *
 * Built after the photography map (@ors/kit's PhotographyScreen): the pins are
 * the places inside the viewport, and the viewport is derived from the
 * camera's centre and zoom plus the measured size of the view (`boundsFor`),
 * committed only once the camera settles. A place is one pin however many
 * posts were made there; tapping it brings that place's posts up as a
 * carousel over the foot of the map — EventsMap's peeking cards — and a post
 * opens in a summary panel as the home feed draws it (PostSummaryModal).
 *
 * The filters ask two things: how far back (`since`) and whose posts (`who`).
 * Following and Mine only mean something signed in, so signed out the panel
 * offers When alone and the server is asked for everyone's.
 */

/** Where the map starts before it knows better — continental US. */
const DEFAULT_CAMERA = { coordinates: { latitude: 39.5, longitude: -98.35 }, zoom: 3 };
/** Close enough to see the streets around you, far enough to see the pins. */
const HERE_ZOOM = 12;
/** Close enough to see the address you searched for and what's posted round it. */
const ADDRESS_ZOOM = 15;
/** How far the +/- buttons can take the map — the whole country to a single block. */
const MIN_ZOOM = 3;
const MAX_ZOOM = 20;
/**
 * How long the camera must sit still before the pins are re-fetched — the
 * photography map's figure: a flick-pan across a city is one request.
 */
const SETTLE_MS = 400;
/** The selected place's posts — a carousel's worth, not the whole history. */
const PLACE_POSTS_LIMIT = 20;

type Since = NonNullable<PostMapParams['since']>;
type Who = NonNullable<PostMapParams['who']>;

/** What the filter panel asks: how far back, and whose. */
interface PostMapFilters {
  since: Since;
  who: Who;
}

const SINCE_OPTIONS: { key: Since; label: string }[] = [
  { key: '', label: 'Any time' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
];

const WHO_OPTIONS: { key: Who; label: string }[] = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'following', label: 'Following' },
  { key: 'mine', label: 'Mine' },
];

const SCREEN_WIDTH = Dimensions.get('window').width;
/** A card in the place's carousel: the width less a peek of the next one — EventsMap's measure. */
const PEEK_CARD_W = SCREEN_WIDTH - 24 - 36;
const PEEK_GAP = 10;

const postsLabel = (n: number) => `${n} ${n === 1 ? 'post' : 'posts'}`;

export default function PostsMapScreen() {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const brand = useBrandColor();
  const insets = useSafeAreaInsets();
  const headerPad = useHeaderPad();
  const signedIn = !!useAppSelector((s) => s.auth.userInfo);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<PostMapFilters>({ since: '', who: 'everyone' });
  // Signing out under a Following/Mine filter leaves it naming nobody — back to everyone.
  const who: Who = signedIn ? filters.who : 'everyone';

  // ── Camera ────────────────────────────────────────────────────────────────
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  /**
   * The camera the map mounts on. `cameraPosition` is only the *initial*
   * position on both maps — later moves go through the ref (see moveTo), as
   * on the photography map.
   */
  const [camera] = useState(DEFAULT_CAMERA);
  const liveCamera = useRef({
    lat: DEFAULT_CAMERA.coordinates.latitude,
    lng: DEFAULT_CAMERA.coordinates.longitude,
    zoom: DEFAULT_CAMERA.zoom,
  });
  const mapRef = useRef<AppleMaps.MapView | GoogleMaps.MapView | null>(null);
  /**
   * Google Maps rejects a camera move until it has loaded, and a location fix
   * can land first — an early move waits here for `onMapLoaded`. Apple Maps
   * is ready as soon as it mounts.
   */
  const mapLoaded = useRef(Platform.OS === 'ios');
  const pendingCamera = useRef<typeof DEFAULT_CAMERA | null>(null);
  /** Set once the member has moved the map somewhere themselves, so a late GPS fix doesn't undo it. */
  const steered = useRef(false);
  const [locationOn, setLocationOn] = useState(false);

  /**
   * Move the live map. Google's setter is a promise that rejects when the
   * next move interrupts this one ("Animation cancelled") — not an error.
   */
  const moveCamera = useCallback((position: typeof DEFAULT_CAMERA) => {
    try {
      Promise.resolve(mapRef.current?.setCameraPosition(position as any)).catch(() => {});
    } catch {
      // Not mounted yet; the map mounts on DEFAULT_CAMERA and the next move lands.
    }
  }, []);

  const moveTo = useCallback((lat: number, lng: number, zoom: number) => {
    const next = { coordinates: { latitude: lat, longitude: lng }, zoom };
    liveCamera.current = { lat, lng, zoom };
    if (mapLoaded.current) moveCamera(next);
    else pendingCamera.current = next;
  }, [moveCamera]);

  const onMapLoaded = useCallback(() => {
    mapLoaded.current = true;
    const waiting = pendingCamera.current;
    pendingCamera.current = null;
    if (waiting) moveCamera(waiting);
  }, [moveCamera]);

  /** The +/- buttons: a step in or out from wherever the map is now, keeping its centre. */
  const zoomBy = useCallback((step: number) => {
    const { lat, lng, zoom } = liveCamera.current;
    steered.current = true;
    moveTo(lat, lng, Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + step)));
  }, [moveTo]);

  /**
   * Open on the member when the app already may know where they are.
   *
   * Unlike the photography map this never asks: a map of other people's posts
   * is something you look at, and opening it shouldn't come with a prompt.
   * Already granted, it's the photography map's two-step — the last known fix,
   * instant, then a fresh one to correct it. Otherwise the continent, and the
   * locate button is where permission gets asked for.
   */
  useEffect(() => {
    let cancelled = false;
    const go = (lat: number, lng: number) => {
      if (cancelled || steered.current) return;
      moveTo(lat, lng, HERE_ZOOM);
    };
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      setLocationOn(true);
      try {
        const cached = await Location.getLastKnownPositionAsync();
        if (cached) go(cached.coords.latitude, cached.coords.longitude);
      } catch {
        // Nothing cached is the common case, not a failure.
      }
      try {
        const here = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), 10000)),
        ]);
        go(here.coords.latitude, here.coords.longitude);
      } catch (err) {
        console.warn('[posts map] no location fix:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [moveTo]);

  /**
   * Locate me — the one place this screen asks for location. Declined for
   * good, it says where to turn it back on rather than doing nothing.
   */
  const [locating, setLocating] = useState(false);
  const locateMe = useCallback(async () => {
    if (locating) return;
    setLocating(true);
    try {
      let { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted' && canAskAgain) {
        ({ status, canAskAgain } = await Location.requestForegroundPermissionsAsync());
      }
      if (status !== 'granted') {
        if (!canAskAgain) {
          Alert.alert(
            'Location is off',
            'Allow location for ORS in Settings to see posts around you.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Settings', onPress: () => Linking.openSettings() },
            ],
          );
        }
        return;
      }
      setLocationOn(true);
      steered.current = true;
      const cached = await Location.getLastKnownPositionAsync().catch(() => null);
      if (cached) moveTo(cached.coords.latitude, cached.coords.longitude, Math.max(HERE_ZOOM, liveCamera.current.zoom));
      const here = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), 10000)),
      ]);
      moveTo(here.coords.latitude, here.coords.longitude, Math.max(HERE_ZOOM, liveCamera.current.zoom));
    } catch (err) {
      console.warn('[posts map] locate failed:', err);
    } finally {
      setLocating(false);
    }
  }, [locating, moveTo]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height });
  };

  /**
   * The camera, once it has stopped moving — a timer each move restarts, as on
   * the photography map, since neither map reports "the finger let go".
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

  /**
   * The first bounds, before any pan. iOS reports the initial camera through
   * onCameraMove; Android doesn't always, and the map would sit empty until
   * touched — so once the view has a size, the starting camera counts.
   */
  useEffect(() => {
    if (bounds || size.width === 0) return;
    const { lat, lng, zoom } = liveCamera.current;
    const first = boundsFor({ lat, lng }, zoom, size.width, size.height);
    if (first) setBounds(first);
  }, [size.width, size.height, bounds]);

  // ── Places ────────────────────────────────────────────────────────────────
  const { data, isFetching } = useGetPostMapPlacesQuery(
    { ...(bounds as MapBounds), since: filters.since, who },
    { skip: !bounds },
  );
  const places = useMemo(() => data?.places ?? [], [data]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  /**
   * The selected place, kept while a refetch after a pan leaves it off the
   * new page — the carousel shouldn't vanish because the map nudged.
   */
  const lastSelected = useRef<PostMapPlace | null>(null);
  const selected = useMemo(() => {
    if (!selectedId) return null;
    const found = places.find((p) => p.place_id === selectedId);
    if (found) lastSelected.current = found;
    return found ?? (lastSelected.current?.place_id === selectedId ? lastSelected.current : null);
  }, [places, selectedId]);

  /**
   * One pin per place. Apple Maps' balloon carries the count as its monogram
   * (two characters at most, so a busier place gets a stack symbol instead);
   * Google's stock pin takes no text, so the count is the callout's snippet.
   */
  const markers = useMemo(() => places
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => ({
      id: p.place_id,
      coordinates: { latitude: p.lat, longitude: p.lng },
      title: p.name,
      snippet: postsLabel(p.count),
      tintColor: brand,
      ...(Platform.OS === 'ios'
        ? (p.count < 100 ? { monogram: String(p.count) } : { systemImage: 'square.stack.fill' })
        : {}),
    })), [places, brand]);

  const onMarkerClick = useCallback((m: { id?: string }) => {
    if (m.id) setSelectedId(m.id);
  }, []);

  // ── The place's posts ─────────────────────────────────────────────────────
  // `currentData`, not `data`: a newly tapped place mustn't show the last
  // place's posts while its own load.
  const { currentData: postsData, isFetching: postsLoading } = useGetPostsQuery(
    { place_id: selected?.place_id ?? '', limit: PLACE_POSTS_LIMIT },
    { skip: !selected },
  );
  const placePosts: Post[] = selected ? (postsData?.entries ?? []) : [];

  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [openOrigin, setOpenOrigin] = useState<SummaryOrigin | null>(null);
  const openRow = useCallback((post: Post, origin: SummaryOrigin | null) => {
    setOpenOrigin(origin);
    setOpenPost(post);
  }, []);

  // ── Search ────────────────────────────────────────────────────────────────
  const [address, setAddress] = useState('');
  const goToAddress = useCallback((place: { lat?: number | null; lng?: number | null }) => {
    if (place.lat == null || place.lng == null) return;
    setAddress('');
    setSelectedId(null);
    steered.current = true;
    moveTo(place.lat, place.lng, ADDRESS_ZOOM);
  }, [moveTo]);

  const pills: FilterPill[] = [
    ...(filters.since ? [{ key: 'since', label: SINCE_OPTIONS.find((o) => o.key === filters.since)?.label ?? 'Any time' }] : []),
    ...(who !== 'everyone' ? [{ key: 'who', label: WHO_OPTIONS.find((o) => o.key === who)?.label ?? 'Everyone' }] : []),
  ];

  const mapProps = {
    style: StyleSheet.absoluteFill,
    cameraPosition: camera,
    onMarkerClick,
    onCameraMove,
    // A tap on the map itself puts the carousel away.
    onMapClick: () => setSelectedId(null),
  };

  const empty = !!data && !isFetching && places.length === 0;
  const footBottom = insets.bottom + 16;

  /**
   * One post in the place's carousel — PlacePostRow, the compact row the
   * place's own list uses, raised onto a card so it reads over the map.
   */
  const postRow = (post: Post, width?: number) => (
    <PlacePostRow
      key={post.internal_id}
      post={post}
      onPress={(origin) => openRow(post, origin)}
      style={[styles.row, { backgroundColor: colors.card, borderColor: colors.borderDark }, width != null && { width }]}
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* The app header floats over the screen, so the heading starts clear
          of it via useHeaderPad() — as Routes does. Its own back stays off
          (see AppHeader), so the heading brings one. */}
      <AppHeader />

      <View style={[styles.heading, { paddingTop: headerPad + 8 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { borderColor: colors.borderDark }]}
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={22} color={colors.fg} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={1}>Posts Map</Text>
      </View>

      <View style={styles.mapWrap} onLayout={onLayout}>
        {Platform.OS === 'ios'
          ? (
            <AppleMaps.View
              ref={mapRef as any}
              {...mapProps}
              markers={markers as any}
              properties={{ isMyLocationEnabled: locationOn }}
            />
          )
          : (
            <GoogleMaps.View
              ref={mapRef as any}
              {...mapProps}
              markers={markers as any}
              properties={{ isMyLocationEnabled: locationOn }}
              uiSettings={{ zoomControlsEnabled: false, mapToolbarEnabled: false, myLocationButtonEnabled: false }}
              onMapLoaded={onMapLoaded}
            />
          )}

        {/* Search and filter, floating along the top as on the photography
            map. The search moves the map; the suggestions drop down over it. */}
        <View style={styles.tools} pointerEvents="box-none">
          <View style={styles.toolsRow} pointerEvents="box-none">
            <AddressField
              value={address}
              onChangeText={setAddress}
              near={{ lat: liveCamera.current.lat, lng: liveCamera.current.lng }}
              placeholder="Search a place"
              onPlacePicked={goToAddress}
              floating
              style={styles.mapSearch}
              inputStyle={[styles.searchInput, { color: colors.fg, borderColor: colors.borderDark, backgroundColor: colors.card }]}
            />
            <FilterSummaryRow<PostMapFilters>
              value={{ since: filters.since, who }}
              onApply={setFilters}
              pills={pills}
              compact
              style={styles.mapShadow}
            >
              {(draft, setDraft) => (
                <>
                  <FilterChoiceRow<Since>
                    label="When"
                    options={SINCE_OPTIONS}
                    selected={draft.since}
                    onSelect={(since) => setDraft((d) => ({ ...d, since }))}
                  />
                  {/* Whose only means something signed in — Following and
                      Mine are measured from you. Signed out, it's everyone's. */}
                  {signedIn && (
                    <>
                      <FilterDivider />
                      <FilterChoiceRow<Who>
                        label="Whose"
                        options={WHO_OPTIONS}
                        selected={draft.who}
                        onSelect={(next) => setDraft((d) => ({ ...d, who: next }))}
                      />
                    </>
                  )}
                  <FilterDivider last />
                </>
              )}
            </FilterSummaryRow>
          </View>

          {/* Nothing here: said quietly under the search, not over the map. */}
          {empty && (
            <View style={[styles.note, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.noteText, { color: colors.grey }]}>
                No posts in this area{filters.since || who !== 'everyone' ? ' with these filters' : ''}.
              </Text>
            </View>
          )}
        </View>

        {/* Zoom and locate, bottom left, stepping up out of the carousel's way
            while a place is open. */}
        <View
          style={[styles.controls, { bottom: selected ? footBottom + ROW_H + 52 : footBottom }]}
          pointerEvents="box-none"
        >
          <View style={[styles.zoom, styles.mapShadow]}>
            <TouchableOpacity style={styles.zoomBtn} onPress={() => zoomBy(1)} activeOpacity={0.7}
              accessibilityRole="button" accessibilityLabel="Zoom in">
              <Plus size={18} color={COLOR_WHITE} strokeWidth={2.6} />
            </TouchableOpacity>
            <View style={styles.zoomRule} />
            <TouchableOpacity style={styles.zoomBtn} onPress={() => zoomBy(-1)} activeOpacity={0.7}
              accessibilityRole="button" accessibilityLabel="Zoom out">
              <Minus size={18} color={COLOR_WHITE} strokeWidth={2.6} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.zoom, styles.mapShadow, styles.zoomBtn, locating && { opacity: 0.6 }]}
            onPress={locateMe}
            disabled={locating}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Show my location"
          >
            <LocateFixed size={18} color={COLOR_WHITE} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        {/* The tapped place's posts over the foot of the map — one card, or a
            carousel with the next peeking in when there are several, as on
            EventsMap. The place's name and count sit just above. */}
        {selected && (
          <View style={[styles.foot, { bottom: footBottom }]} pointerEvents="box-none">
            <View style={[styles.placeLabel, styles.mapShadow, { backgroundColor: colors.card }]}>
              <MapPin size={13} color={brand} strokeWidth={2.4} />
              <Text style={[styles.placeName, { color: colors.fg }]} numberOfLines={1}>{selected.name}</Text>
              <Text style={[styles.placeCount, { color: colors.grey }]}>{postsLabel(selected.count)}</Text>
            </View>

            {placePosts.length === 1 ? (
              <View style={styles.single}>{postRow(placePosts[0])}</View>
            ) : placePosts.length > 1 ? (
              <ScrollView
                horizontal
                style={styles.carousel}
                contentContainerStyle={styles.carouselRow}
                showsHorizontalScrollIndicator={false}
                snapToInterval={PEEK_CARD_W + PEEK_GAP}
                snapToAlignment="start"
                decelerationRate="fast"
              >
                {placePosts.map((p) => postRow(p, PEEK_CARD_W))}
              </ScrollView>
            ) : (
              <View style={[styles.single]}>
                <View style={[styles.row, styles.rowPlaceholder, { backgroundColor: colors.card, borderColor: colors.borderDark }]}>
                  <Text style={[styles.rowMeta, { color: colors.grey }]}>
                    {postsLoading ? 'Loading posts…' : 'No posts to show here.'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* "Modal" here is the summary panel — the post as the home feed draws it. */}
      <PostSummaryModal
        post={openPost}
        origin={openOrigin}
        onClose={() => setOpenPost(null)}
      />
    </View>
  );
}

/** A carousel row's height — the thumb plus its padding — for lifting the map controls clear. */
const ROW_H = 56 + 20;

const styles = StyleSheet.create({
  root: { flex: 1 },

  heading: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: GUTTER + 6, paddingBottom: 10,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: COMMON_RADIUS, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  // ScreenHeading's inline size — it shares the row with a control.
  title: { fontSize: 24, fontFamily: FONT_INTER.semibold, letterSpacing: -0.3, flexShrink: 1 },

  mapWrap: { flex: 1, overflow: 'hidden' },

  // The floating row: search taking the width, the filter beside it. Raised so
  // the search's suggestions draw over the map and the carousel.
  tools: { position: 'absolute', top: 10, left: 12, right: 12, zIndex: 10 },
  // Constant, like AddressField's own — a zIndex that changes drops focus.
  toolsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, zIndex: 2, elevation: 2 },
  mapShadow: { borderRadius: 22, boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.35)' },
  mapSearch: { flex: 1, borderRadius: 22, boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.35)' },
  searchInput: {
    height: 44, borderWidth: 1, borderRadius: 22,
    paddingHorizontal: 16, fontSize: 14,
  },
  note: {
    alignSelf: 'center', marginTop: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth,
  },
  noteText: { fontSize: 12.5, fontFamily: FONT_INTER.semibold },

  // Dark glass with a white hairline, as on the photography map.
  controls: { position: 'absolute', left: 12, gap: 10, zIndex: 5 },
  zoom: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  zoomBtn:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  zoomRule: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.4)' },

  foot: { position: 'absolute', left: 0, right: 0, zIndex: 6 },
  placeLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', maxWidth: SCREEN_WIDTH - 24,
    marginLeft: 12, paddingHorizontal: 12, paddingVertical: 6,
  },
  placeName:  { fontSize: 13, fontFamily: FONT_INTER.bold, flexShrink: 1 },
  placeCount: { fontSize: 12, fontFamily: FONT_INTER.semibold },
  single: { paddingHorizontal: 12, paddingVertical: 12 },
  carousel: { flexGrow: 0 },
  // Padded vertically for the cards' shadow, which a scroller would clip.
  carouselRow: { paddingHorizontal: 12, gap: PEEK_GAP, paddingVertical: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 10, borderRadius: COMMON_RADIUS, borderWidth: StyleSheet.hairlineWidth,
    shadowColor: COLOR_BLACK, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  rowPlaceholder: { height: ROW_H, justifyContent: 'center' },
  rowMeta:  { fontSize: 12, fontFamily: FONT_INTER.semibold },
});
