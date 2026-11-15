import React from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from '../theme/Text';
import { MapPin, Crosshair } from 'lucide-react-native';
import SummaryModal, { useSummaryPanel } from '../components/SummaryModal';
import { useColors, useBrandColor } from '../theme/useColors';
import { useGetNearbyPlacesQuery } from '../api/orsApi';
import type { NearbyPlace } from '../types/ors';
import { FONT_INTER } from '../theme/fonts'

/**
 * How far around the dropped point to look for a named place — about 50
 * feet: what you're standing at, not the block. A park or lot you're inside
 * still comes back, however far its centre is (see horacio's nearby).
 */
const NEARBY_M = 15;
/** The same, in feet rounded to the ten, for the empty message. */
const NEARBY_FT = Math.round((NEARBY_M * 3.281) / 10) * 10;

/** Where a pin is going: a coordinate, and the place it's at when one was chosen. */
export interface DropPoint {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
}

export interface DropPinSheetProps {
  /** The held point, or null when the sheet is closed. */
  point: { lat: number; lng: number } | null;
  onClose: () => void;
  /** The member chose where the pin goes. Runs once the sheet has closed. */
  onChoose: (point: DropPoint) => void;
}

/**
 * What a held point becomes.
 *
 * A finger on the map is rarely on the exact thing: it's on the park, near
 * the garage. So before the form opens, this offers the named places within
 * a few steps of the point — pick one and the pin goes on the place, named
 * after it — with the exact coordinate always the first choice.
 */
export default function DropPinSheet({ point, onClose, onChoose }: DropPinSheetProps) {
  return (
    <SummaryModal visible={!!point} onClose={onClose}>
      {point ? <Choices point={point} onChoose={onChoose} /> : null}
    </SummaryModal>
  );
}

/** Inside the panel, so choosing can close it first and then hand off — a screen can't open over a modal on iOS. */
function Choices({ point, onChoose }: { point: { lat: number; lng: number }; onChoose: (p: DropPoint) => void }) {
  const colors = useColors();
  const brand = useBrandColor();
  const panel = useSummaryPanel();
  const { data, isFetching } = useGetNearbyPlacesQuery({ lat: point.lat, lng: point.lng, radius: NEARBY_M });
  const places = data?.places ?? [];

  const choose = (p: DropPoint) => (panel ? panel.closeThen(() => onChoose(p)) : onChoose(p));

  return (
    <View style={styles.body}>
      <Text style={[styles.title, { color: colors.fg }]}>Pin a spot here</Text>

      <TouchableOpacity
        style={[styles.exact, { backgroundColor: brand }]}
        onPress={() => choose({ lat: point.lat, lng: point.lng })}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <Crosshair size={16} color="#000000" strokeWidth={2.4} />
        <Text style={styles.exactText}>Use this exact spot</Text>
      </TouchableOpacity>

      <Text style={[styles.label, { color: colors.grey }]}>Or pin it at a place nearby</Text>

      {isFetching && places.length === 0 ? (
        <View style={styles.wait}><ActivityIndicator size="small" color={colors.grey} /></View>
      ) : places.length === 0 ? (
        <Text style={[styles.none, { color: colors.grey }]}>No named places within {NEARBY_FT} feet.</Text>
      ) : (
        <View style={[styles.list, { borderColor: colors.border }]}>
          {places.map((place, i) => (
            <PlaceRow
              key={place.place_id}
              place={place}
              last={i === places.length - 1}
              onPress={() => choose({ lat: place.lat, lng: place.lng, name: place.name, address: place.address ?? undefined })}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function PlaceRow({ place, last, onPress }: { place: NearbyPlace; last: boolean; onPress: () => void }) {
  const colors = useColors();
  const kind = place.types[0]?.replace(/_/g, ' ');
  return (
    <TouchableOpacity
      style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Pin at ${place.name}`}
    >
      <MapPin size={16} color={colors.fg} />
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: colors.fg }]} numberOfLines={1}>{place.name}</Text>
        <Text style={[styles.detail, { color: colors.grey }]} numberOfLines={1}>
          {[kind, place.address].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Text style={[styles.distance, { color: colors.grey }]}>{Math.round(place.distance_m * 3.281)} ft</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  body:   { padding: 18, paddingBottom: 22, gap: 10 },
  title:  { fontSize: 20, fontFamily: FONT_INTER.bold },
  exact: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 12, paddingVertical: 13, marginTop: 6,
  },
  exactText: { fontSize: 15, fontFamily: FONT_INTER.extrabold, color: '#000000' },
  label: { fontSize: 13, fontFamily: FONT_INTER.bold, marginTop: 8 },
  wait:  { paddingVertical: 14, alignItems: 'center' },
  none:  { fontSize: 13, paddingVertical: 6 },
  list:  { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  rowText:  { flex: 1 },
  name:     { fontSize: 14, fontFamily: FONT_INTER.bold },
  detail:   { fontSize: 12, marginTop: 1 },
  distance: { fontSize: 12, fontVariant: ['tabular-nums'], fontFamily: FONT_INTER.semibold },
});
