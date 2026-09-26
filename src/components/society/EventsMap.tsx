import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { format } from 'date-fns';
import { MapPin, ChevronRight } from 'lucide-react-native';
import SharedModal from '../ui/SharedModal';
import { categoryFor, parseDayKey } from '../../constants/eventTypes';
import { firstGalleryUrl } from '../../utils/image';
import { useColors } from '../../hooks/useColors';
import { COMMON_RADIUS } from '../../constants/radius';
import type { SocietyEvent } from '../../types/api';

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
      colors={['#262626', '#5A5A5A']}
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
            <MapPin size={20} color="#FFFFFF" />
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

/**
 * The upcoming events as pins, in a sheet that slides up over the Events
 * screen rather than a screen of its own — it's a different view of the list
 * you're on, and closing it should leave you where you were.
 *
 * Pins are the event category's colour (Apple Maps: a calendar symbol tinted
 * to it; Google Maps draws its own pin, which takes no tint). Tapping one
 * brings up the event underneath the map; tapping that opens the event.
 */
export function EventsMapSheet({ visible, onClose, events, onOpenEvent, onDismissed }: {
  visible: boolean;
  onClose: () => void;
  events: SocietyEvent[];
  /** The preview card was tapped. The host closes the sheet and opens the event. */
  onOpenEvent: (event: SocietyEvent) => void;
  onDismissed?: () => void;
}) {
  const colors = useColors();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = events.find((e) => e.internal_id === selectedId) ?? null;

  const camera = useMemo(() => (events.length ? cameraFor(events) : null), [events]);
  const markers = useMemo(() => events.map((e) => ({
    id: e.internal_id,
    coordinates: { latitude: e.location_lat as number, longitude: e.location_lng as number },
    title: e.title,
    ...(Platform.OS === 'ios'
      ? { systemImage: 'calendar', tintColor: categoryFor(e.category).color }
      : {}),
  })), [events]);

  const mapProps = {
    style: StyleSheet.absoluteFill,
    cameraPosition: camera ?? undefined,
    onMarkerClick: (m: { id?: string }) => { if (m.id) setSelectedId(m.id); },
  };

  const day = selected ? parseDayKey(selected.occurrence_date) : null;
  const cat = selected ? categoryFor(selected.category) : null;
  const photo = selected ? firstGalleryUrl(selected.gallery) : null;

  return (
    <SharedModal
      visible={visible}
      onClose={onClose}
      onDismissed={() => { setSelectedId(null); onDismissed?.(); }}
      title="Upcoming events"
      heightRatio={0.9}
    >
      <View style={styles.mapWrap}>
        {camera && (Platform.OS === 'ios'
          ? <AppleMaps.View {...mapProps} markers={markers as any} />
          : (
            <GoogleMaps.View
              {...mapProps}
              markers={markers as any}
              uiSettings={{ zoomControlsEnabled: false, mapToolbarEnabled: false }}
            />
          ))}

        {/* The tapped pin's event, floating over the foot of the map. */}
        {selected && (
          <TouchableOpacity
            style={[styles.preview, { backgroundColor: colors.card, borderColor: colors.borderDark }]}
            onPress={() => onOpenEvent(selected)}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={`Open ${selected.title ?? 'event'}`}
          >
            {photo
              ? <Image source={{ uri: photo }} style={styles.previewPhoto} contentFit="cover" />
              : <View style={[styles.previewPhoto, { backgroundColor: '#161616' }]} />}
            <View style={styles.previewText}>
              {cat && (
                <View style={[styles.catPill, { backgroundColor: cat.color }]}>
                  <Text style={styles.catText}>{cat.label}</Text>
                </View>
              )}
              <Text style={[styles.previewTitle, { color: colors.fg }]} numberOfLines={1}>{selected.title}</Text>
              <Text style={[styles.previewMeta, { color: colors.grey }]} numberOfLines={1}>
                {[day ? format(day, 'EEE, MMM d') : null, selected.location].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.grey} />
          </TouchableOpacity>
        )}
      </View>
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  tileFrame: { marginHorizontal: 12, marginTop: 24, padding: 1.5, borderRadius: 12 },
  tile: {
    height: 112, borderRadius: 10.5, overflow: 'hidden',
    backgroundColor: '#0A0A0A', justifyContent: 'flex-end',
  },
  tileText:  { paddingHorizontal: 14, paddingBottom: 12, gap: 3 },
  tileTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', flexShrink: 1 },
  tileSub:   { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },

  mapWrap: { flex: 1, minHeight: 300 },
  preview: {
    position: 'absolute', left: 12, right: 12, bottom: 24,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 10, borderRadius: COMMON_RADIUS, borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  previewPhoto: { width: 56, height: 56, borderRadius: 8 },
  previewText:  { flex: 1, minWidth: 0, gap: 3 },
  catPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  catText: { fontSize: 10, fontWeight: '800', color: '#000000' },
  previewTitle: { fontSize: 15, fontWeight: '800' },
  previewMeta:  { fontSize: 12, fontWeight: '600' },
});
