import React, { useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, ScrollView, Dimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../theme/Text';
import { Image } from '../ui/AppImage';
import { LinearGradient } from 'expo-linear-gradient';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { format } from 'date-fns';
import { MapPin, ChevronRight, X } from 'lucide-react-native';
import SharedModal, { PANE_GRABBER_H } from '../ui/SharedModal';
import { categoryFor, parseDayKey } from '../../constants/eventTypes';
import { firstGalleryUrl } from '../../utils/image';
import { useColors } from '../../hooks/useColors';
import { COMMON_RADIUS, COLOR_BLACK, COLOR_GRAY_38, COLOR_GRAY_90, COLOR_WHITE, GUTTER, SURFACE_BLACK, SURFACE_MID } from '../../constants/config';
import type { SocietyEvent } from '../../types/api';
import { FONT_INTER } from '../../constants/fonts'

/**
 * A dark, label-free street map (Portland), behind the tile's label — so the
 * tile reads as a map you tap into. A static picture, not a live map: it's
 * decoration, and a map view per render of the events list would be costly.
 * Google's attribution is part of the image and has to stay.
 */
const TILE_MAP = require('../../../assets/events-map.jpg');

/**
 * The upcoming events that can be put on a map: one per event, at its earliest
 * occurrence in the window, and only those with a picked address — a typed
 * "City, ST" has no coordinate to stand a pin on.
 */
export function mappableEvents(events: SocietyEvent[]): SocietyEvent[] {
  const byId = new Map<string, SocietyEvent>();
  for (const e of events) {
    if (typeof e.location_lat !== 'number' || typeof e.location_lng !== 'number') continue;
    const had = byId.get(e.internal_id);
    if (!had || String(e.occurrence_date ?? '') < String(had.occurrence_date ?? '')) byId.set(e.internal_id, e);
  }
  return [...byId.values()];
}

/**
 * "View upcoming events on a map" — the way into the map sheet, styled after
 * the menu's Photography tile: full width, a hairline gradient frame, and a
 * dark map behind the label. Nothing at all when no upcoming event has an
 * address to pin.
 */
export function EventsMapTile({ events, days, onPress }: {
  events: SocietyEvent[];
  /** The window the events cover — for the subtitle. */
  days: number;
  onPress: () => void;
}) {
  if (events.length === 0) return null;

  return (
    <LinearGradient
      colors={[COLOR_GRAY_38, COLOR_GRAY_90]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.tileFrame}
    >
      <TouchableOpacity
        style={styles.tile}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="View upcoming events on a map"
      >
        <Image source={TILE_MAP} style={StyleSheet.absoluteFill} contentFit="cover" />
        {/* Lighter than over photos: the map is already dark, and should show. */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
          locations={[0.35, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 0.7, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.tileText}>
          <View style={styles.tileTitleRow}>
            <MapPin size={20} color={COLOR_WHITE} />
            <Text style={styles.tileTitle}>View upcoming events on a map</Text>
          </View>
          <Text style={styles.tileSub} numberOfLines={1}>
            {events.length} {events.length === 1 ? 'event' : 'events'} in the next {days} days
          </Text>
        </View>
      </TouchableOpacity>
    </LinearGradient>
  );
}

/**
 * A camera that shows every pin: the middle of their bounding box, zoomed so
 * the wider of its two spans fits with some margin. One pin gets a town's
 * worth of map around it rather than a street.
 */
function cameraFor(events: SocietyEvent[]) {
  const lats = events.map((e) => e.location_lat as number);
  const lngs = events.map((e) => e.location_lng as number);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const span = Math.max(maxLat - minLat, (maxLng - minLng) * 0.8, 0.05);
  const zoom = Math.max(3, Math.min(11, Math.log2(360 / span) - 1.2));
  return {
    coordinates: { latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2 },
    zoom,
  };
}

/** Events at the same spot share a pin — keyed by their coordinate, to about a metre. */
const spotKey = (e: SocietyEvent) =>
  `${(e.location_lat as number).toFixed(5)},${(e.location_lng as number).toFixed(5)}`;

const SCREEN_WIDTH = Dimensions.get('window').width;
/**
 * A tapped event's card: narrower than the screen and centred, like a summary
 * panel — and in a spot's carousel, the next one peeks in at the side.
 */
const CARD_W = Math.min(340, Math.round(SCREEN_WIDTH * 0.8));
const PEEK_CARD_W = CARD_W;
const PEEK_GAP = 10;

/**
 * The upcoming events as pins, in a sheet that slides up over the Events
 * screen rather than a screen of its own — it's a different view of the list
 * you're on, and closing it should leave you where you were.
 *
 * Pins are the event category's colour (Apple Maps: a calendar symbol tinted
 * to it; Google Maps draws its own pin, which takes no tint). Tapping one
 * brings up the event underneath the map; tapping that opens the event.
 */
export function EventsMapSheet({ visible, onClose, events, onOpenEvent, onDismissed, tools }: {
  visible: boolean;
  /**
   * Search and filter, laid over the top of the map — the Events screen's own,
   * passed in so the two stay one choice.
   */
  tools?: React.ReactNode;
  onClose: () => void;
  events: SocietyEvent[];
  /** The preview card was tapped. The host closes the sheet and opens the event. */
  onOpenEvent: (event: SocietyEvent) => void;
  onDismissed?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    // No title row: the map runs up to the pane's top, under the floating
    // grabber, and to its foot, under the home indicator. The map's own state
    // (the tapped pin) goes with it when the pane closes and unmounts it.
    <SharedModal
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      hideHeader
      edgeToEdge
      heightRatio={0.9}
    >
      <EventsMapView
        events={events}
        onOpenEvent={onOpenEvent}
        tools={tools}
        topInset={PANE_GRABBER_H + 6}
        bottomInset={insets.bottom + 16}
      />
    </SharedModal>
  );
}

/**
 * The map itself — pins, the tools over its top and the tapped pin's cards
 * over its foot. The sheet above wraps it; the home screen's Events › Map
 * shows it as a whole pane, under the floating header.
 */
export function EventsMapView({ events, onOpenEvent, tools, topInset, bottomInset, style }: {
  events: SocietyEvent[];
  onOpenEvent: (event: SocietyEvent) => void;
  /** Laid over the top of the map. */
  tools?: React.ReactNode;
  /** How far down the tools sit — clear of whatever floats over the map's top. */
  topInset: number;
  /** How far up the preview cards sit — clear of whatever covers its foot. */
  bottomInset: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  // The tapped pin's spot, and every event at it.
  const [selectedSpot, setSelectedSpot] = useState<string | null>(null);
  const selectedEvents = useMemo(
    () => (selectedSpot ? events.filter((e) => spotKey(e) === selectedSpot) : []),
    [events, selectedSpot],
  );

  const camera = useMemo(() => (events.length ? cameraFor(events) : null), [events]);
  // One pin per spot, however many events are at it — stacked pins only ever
  // gave up the top one. Coloured for the spot's first event.
  const markers = useMemo(() => {
    const bySpot = new Map<string, SocietyEvent[]>();
    for (const e of events) bySpot.set(spotKey(e), [...(bySpot.get(spotKey(e)) ?? []), e]);
    return [...bySpot.entries()].map(([key, at]) => ({
      id: key,
      coordinates: { latitude: at[0].location_lat as number, longitude: at[0].location_lng as number },
      title: at.length > 1 ? `${at.length} events` : at[0].title,
      ...(Platform.OS === 'ios'
        ? { systemImage: 'calendar', tintColor: categoryFor(at[0].category).color }
        : {}),
    }));
  }, [events]);

  const mapProps = {
    style: StyleSheet.absoluteFill,
    cameraPosition: camera ?? undefined,
    onMarkerClick: (m: { id?: string }) => { if (m.id) setSelectedSpot(m.id); },
    // A tap on the map itself puts the card away.
    onMapClick: () => setSelectedSpot(null),
  };

  /**
   * One event's card over the map — a small summary: the photo on top when
   * there is one (no grey stand-in when there isn't), the type, title, day
   * and place, and View event. The X, or a tap on the map, closes it.
   */
  const previewCard = (ev: SocietyEvent) => {
    const day = parseDayKey(ev.occurrence_date);
    const cat = categoryFor(ev.category);
    const photo = firstGalleryUrl(ev.gallery);
    return (
      <TouchableOpacity
        key={ev.internal_id}
        style={[styles.preview, { backgroundColor: colors.card, borderColor: colors.borderDark }]}
        onPress={() => onOpenEvent(ev)}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`Open ${ev.title ?? 'event'}`}
      >
        {photo ? <Image source={{ uri: photo }} style={styles.previewPhoto} contentFit="cover" /> : null}
        <View style={styles.previewText}>
          <View style={[styles.catPill, { backgroundColor: cat.color }]}>
            <Text style={styles.catText}>{cat.label}</Text>
          </View>
          <Text style={[styles.previewTitle, { color: colors.fg }]} numberOfLines={2}>{ev.title}</Text>
          {day ? <Text style={[styles.previewMeta, { color: colors.fg }]} numberOfLines={1}>{format(day, 'EEEE, MMM d')}</Text> : null}
          {ev.location ? (
            <View style={styles.whereRow}>
              <MapPin size={12} color={colors.grey} />
              <Text style={[styles.previewMeta, { color: colors.grey, flexShrink: 1 }]} numberOfLines={2}>{ev.location}</Text>
            </View>
          ) : null}
          <View style={[styles.viewBtn, { backgroundColor: colors.segment }]}>
            <Text style={[styles.viewText, { color: colors.fg }]}>View event</Text>
            <ChevronRight size={15} color={colors.fg} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  /** The X over the card(s). */
  const closeButton = (
    <TouchableOpacity
      style={styles.close}
      onPress={() => setSelectedSpot(null)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Close"
    >
      <X size={16} color={COLOR_WHITE} strokeWidth={2.6} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.mapWrap, style]}>
      {camera && (Platform.OS === 'ios'
        ? <AppleMaps.View {...mapProps} markers={markers as any} />
        : (
          <GoogleMaps.View
            {...mapProps}
            markers={markers as any}
            uiSettings={{ zoomControlsEnabled: false, mapToolbarEnabled: false }}
          />
        ))}

      {/* Search and filter along the top. */}
      {tools ? <View style={[styles.tools, { top: topInset }]}>{tools}</View> : null}

      {/* The tapped pin's events, floating over the foot of the map — one
          card, or a carousel when several share the spot, the next one
          peeking in from the edge. */}
      {selectedEvents.length === 1 ? (
        <View style={[styles.previewDock, { bottom: bottomInset }]} pointerEvents="box-none">
          <View>
            {previewCard(selectedEvents[0])}
            {closeButton}
          </View>
        </View>
      ) : selectedEvents.length > 1 ? (
        <View style={[styles.previewDockScroll, { bottom: bottomInset }]} pointerEvents="box-none">
          <ScrollView
            horizontal
            contentContainerStyle={styles.previewRow}
            showsHorizontalScrollIndicator={false}
            snapToInterval={PEEK_CARD_W + PEEK_GAP}
            snapToAlignment="center"
            decelerationRate="fast"
          >
            {selectedEvents.map((ev) => previewCard(ev))}
          </ScrollView>
          <View style={styles.closeAbove}>{closeButton}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tileFrame: { marginHorizontal: GUTTER, marginTop: 12, padding: 1.5, borderRadius: 12 },
  tile: {
    height: 112, borderRadius: 10.5, overflow: 'hidden',
    backgroundColor: SURFACE_BLACK, justifyContent: 'flex-end',
  },
  tileText:  { paddingHorizontal: 14, paddingBottom: 12, gap: 3 },
  tileTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileTitle: { fontSize: 16, fontFamily: FONT_INTER.bold, color: COLOR_WHITE, flexShrink: 1 },
  tileSub:   { fontSize: 12, fontFamily: FONT_INTER.semibold, color: 'rgba(255,255,255,0.7)' },

  mapWrap: { flex: 1, minHeight: 300 },
  // Edge to edge: the row brings its own side padding.
  tools: { position: 'absolute', left: 0, right: 0, zIndex: 5 },
  // Centred over the map's foot.
  previewDock: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  previewDockScroll: { position: 'absolute', left: 0, right: 0 },
  // Padded vertically for the cards' shadow, which a scroller would clip;
  // the first card starts centred.
  previewRow: { paddingHorizontal: (SCREEN_WIDTH - CARD_W) / 2, gap: PEEK_GAP, paddingVertical: 12 },
  preview: {
    width: CARD_W, overflow: 'hidden',
    borderRadius: COMMON_RADIUS, borderWidth: StyleSheet.hairlineWidth,
    shadowColor: COLOR_BLACK, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  previewPhoto: { width: '100%', aspectRatio: 16 / 9 },
  previewText:  { padding: 14, gap: 5 },
  whereRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  viewBtn: {
    marginTop: 8, height: 38, borderRadius: 19,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  viewText: { fontSize: 14, fontFamily: FONT_INTER.bold },
  // The X: on the card's top right corner, or over the carousel's.
  close: {
    position: 'absolute', top: 8, right: 8,
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  closeAbove: { position: 'absolute', top: 12, left: (SCREEN_WIDTH + CARD_W) / 2 - 46, width: 46, height: 46 },
  catPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  catText: { fontSize: 10, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK },
  previewTitle: { fontSize: 17, fontFamily: FONT_INTER.bold },
  previewMeta:  { fontSize: 13, fontFamily: FONT_INTER.semibold },
});
