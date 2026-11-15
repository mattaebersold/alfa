import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Text, TextInput } from '../theme/Text';
import FormScrollView from '../keyboard/FormScrollView';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import * as Location from 'expo-location';
import { Crosshair, Lock } from 'lucide-react-native';
import AddressField from '../components/AddressField';
import { useColors, useBrandColor } from '../theme/useColors';
import { COMMON_RADIUS } from '../theme/radius';
import { appConfig } from '../constants/appConfig';
import {
  useCreatePhotoSpotMutation, useGetPhotoSpotQuery, useGetPhotoSpotUsageQuery,
} from '../api/orsApi';
import { useUpdatePhotoSpotMutation } from './api';
import { uploadFile } from '../utils/upload';
import { PHOTO_SPOT_TYPES, PHOTO_SPOT_PIN_COLOR } from './constants';
import GalleryEditor, { toEditorImages, type EditorImage } from './GalleryEditor';
import PhotoSpotSummaryModal from './PhotoSpotSummaryModal';
import type { PhotoSpot } from '../types/ors';
import { FONT_INTER } from '../theme/fonts'

/**
 * Pinning a spot.
 *
 * ## The map is the first field
 *
 * Everything else on this screen describes a place; the coordinate *is* the
 * place. So the map is at the top and starts on the member's own position —
 * you pin a spot because you're standing in it, or because you know exactly
 * where it is, and either way the useful default is "here".
 *
 * The pin is dropped by tapping the map. Deliberately not by dragging a marker:
 * expo-maps' draggable markers report their position only on drop, and a pin
 * you can't see moving under your thumb is worse than one that jumps to where
 * you tapped.
 *
 * ## The limit
 *
 * A basic member gets three. The server refuses the fourth regardless of what
 * this screen does — but being told after writing a description and picking
 * four photos is a bad way to find out, so the allowance is read up front and
 * the form is replaced by the upsell when it's gone.
 *
 * ## Hosting it
 *
 * alfa's PhotoSpotCreateScreen, shared by alfa and the photo app, and
 * navigation-agnostic: `initialPoint` or `spotId` come in as props, and the
 * outcome goes out through `onSaved`, which is awaited — alfa saves the spot's
 * tags there, against the saved entry's id, before going back. Anything the
 * host wants on the form (alfa's tag picker) goes in `extraFields`, drawn
 * under the photos; `FormSection` gives it the form's own heading.
 */

const DEFAULT_CAMERA = { coordinates: { latitude: 39.5, longitude: -98.35 }, zoom: 3 };

export interface PhotoSpotCreateScreenProps {
  /** The point the member held the map at. */
  initialPoint?: { lat: number; lng: number } | null;
  /** The place the point was chosen as — a park, a garage — to prefill the name and address. */
  initialPlace?: { name?: string; address?: string } | null;
  /** Edit this spot instead of pinning a new one. */
  spotId?: string | null;
  /**
   * Saved. Awaited, with the form still showing it's busy — usually "save
   * whatever else rides on the spot, then go back". A throw from here is
   * reported as the spot not saving, so swallow what shouldn't be.
   */
  onSaved: (entry: PhotoSpot, info: { isEdit: boolean }) => void | Promise<void>;
  /** The limit's "See Pro" button. Hidden when not given. */
  onUpsell?: () => void;
  /** More of the form, under the photos — alfa's tag picker. */
  extraFields?: React.ReactNode;
}

export default function PhotoSpotCreateScreen({
  initialPoint, initialPlace, spotId, onSaved, onUpsell, extraFields,
}: PhotoSpotCreateScreenProps) {
  const colors = useColors();
  const brand = useBrandColor();
  // The point the member held the map at, when that's how they got here — or
  // the spot they're editing, when that's how.
  const editId = spotId ?? undefined;
  const isEdit = !!editId;
  const droppedPoint = initialPoint && Number.isFinite(initialPoint.lat) && Number.isFinite(initialPoint.lng)
    ? { lat: initialPoint.lat, lng: initialPoint.lng }
    : null;

  // An edit doesn't spend a spot, so the allowance isn't asked.
  const { data: usage, isLoading: usageLoading } = useGetPhotoSpotUsageQuery(undefined, { skip: isEdit });
  const { data: existing, isLoading: loadingExisting } = useGetPhotoSpotQuery(editId as string, { skip: !isEdit });
  const [createSpot, { isLoading: creating }] = useCreatePhotoSpotMutation();
  const [updateSpot, { isLoading: updating }] = useUpdatePhotoSpotMutation();
  /** The host's `onSaved` is running — the spot is saved, the rest isn't yet. */
  const [finishing, setFinishing] = useState(false);
  const saving = creating || updating || finishing;

  // A held-map pin arrives placed, with the map already on it. It's the spot
  // they chose; asking the GPS where they are would move it somewhere else.
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(droppedPoint);
  const [camera, setCamera] = useState(
    droppedPoint
      ? { coordinates: { latitude: droppedPoint.lat, longitude: droppedPoint.lng }, zoom: 16 }
      : DEFAULT_CAMERA,
  );
  /**
   * The map, for moving it after mount. `cameraPosition` only counts at mount
   * on Apple Maps, so a later "use my location" or a picked address has to be
   * handed to the live map as well as to state.
   */
  const mapRef = useRef<AppleMaps.MapView | GoogleMaps.MapView | null>(null);
  const [locating, setLocating] = useState(false);

  const [title, setTitle] = useState(initialPlace?.name ?? '');
  const [body, setBody] = useState('');
  const [location, setLocation] = useState(initialPlace?.address ?? '');
  /** What kind of place — one chip, or none. Drives the filter and the badge. */
  const [type, setType] = useState<string | null>(null);
  const [photos, setPhotos] = useState<EditorImage[]>([]);
  /**
   * The spot that's already where this one was going. The server refuses a
   * second pin within a few metres of one; this opens the first so the
   * member can put their photos on it, which is what they wanted.
   */
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  /** Move the camera — state for a remount, the ref for the live map. */
  const look = useCallback((lat: number, lng: number) => {
    const next = { coordinates: { latitude: lat, longitude: lng }, zoom: 16 };
    setCamera(next);
    // Google's setter rejects when a later move cancels this one; that isn't an error.
    try { Promise.resolve(mapRef.current?.setCameraPosition(next as any)).catch(() => {}); } catch { /* not mounted yet */ }
  }, []);

  // Edit: the saved spot fills the form once, and the map opens on its pin.
  // Whatever the host adds (alfa's tags) prefills itself, or doesn't.
  const prefilled = useRef(false);
  useEffect(() => {
    if (!isEdit || !existing || prefilled.current) return;
    prefilled.current = true;
    setTitle(existing.title ?? '');
    setBody(existing.body ?? '');
    setLocation(existing.location ?? '');
    setType(existing.type ?? null);
    setPhotos(toEditorImages(existing.gallery));
    if (Number.isFinite(existing.lat) && Number.isFinite(existing.lng)) {
      setPoint({ lat: existing.lat, lng: existing.lng });
      look(existing.lat, existing.lng);
    }
  }, [isEdit, existing, look]);

  /** Centre the map on the member, and drop the pin there as a starting guess. */
  const useMyLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location is off',
          `Turn on location for ${appConfig().appName} to drop a pin where you're standing — or tap the map to place one by hand.`,
        );
        return;
      }
      /**
       * The last known fix first, then a fresh one.
       *
       * `getCurrentPositionAsync` waits for the GPS to actually produce a
       * reading, which indoors or in a garage — where a lot of these spots are
       * — can take ten seconds or more with nothing on screen but a spinner.
       * The cached fix is usually metres away and arrives instantly, so the map
       * moves at once and then corrects itself.
       */
      const place = (next: { lat: number; lng: number }) => {
        setPoint(next);
        look(next.lat, next.lng);
      };

      const cached = await Location.getLastKnownPositionAsync();
      if (cached) place({ lat: cached.coords.latitude, lng: cached.coords.longitude });

      // High accuracy because a photo spot is a specific corner, not a
      // neighbourhood — and on Android a member may have granted only
      // "Approximate", which lands the pin up to a kilometre out. The hint
      // under the map tells them to check it either way.
      const here = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      place({ lat: here.coords.latitude, lng: here.coords.longitude });
    } catch {
      Alert.alert("Couldn't find you", 'Tap the map to place the pin instead.');
    } finally {
      setLocating(false);
    }
  }, [look]);

  const onMapClick = useCallback((e: { coordinates?: { latitude?: number; longitude?: number } }) => {
    const lat = e.coordinates?.latitude;
    const lng = e.coordinates?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    setPoint({ lat, lng });
  }, []);

  const save = async () => {
    if (!point) return Alert.alert('Where is it?', 'Tap the map to drop the pin first.');
    if (!title.trim()) return Alert.alert('Name it', 'Give the spot a name so it reads on the map.');

    const fd = new FormData();
    fd.append('lat', String(point.lat));
    fd.append('lng', String(point.lng));
    fd.append('title', title.trim());
    fd.append('body', body.trim());
    fd.append('location', location.trim());
    // Sent even when cleared, so an edit can take a type off.
    fd.append('type', type ?? '');

    // Only the newly picked ones carry a file; on an edit the ones kept are
    // named so the server drops whatever was removed. The part is built by
    // uploadFile, as on every other form: this SDK's fetch throws on the
    // classic `{ uri, name, type }` object before the request is ever sent,
    // which surfaced as "That didn't save" with nothing in the server logs.
    photos.forEach((photo) => {
      if (photo.kind !== 'new') return;
      fd.append('gallery', uploadFile(photo.uri));
    });
    if (isEdit) {
      fd.append('internal_id', editId!);
      fd.append('existing_gallery', JSON.stringify(
        photos.flatMap((p) => (p.kind === 'existing' ? [{ filename: p.filename }] : [])),
      ));
    }

    try {
      const { entry } = isEdit ? await updateSpot(fd).unwrap() : await createSpot(fd).unwrap();
      setFinishing(true);
      try {
        await onSaved(entry, { isEdit });
      } finally {
        setFinishing(false);
      }
    } catch (err: any) {
      const existing = err?.status === 409 ? err?.data?.existing : null;
      if (existing?.internal_id) {
        Alert.alert(
          "There's already a pin here",
          undefined,
          [
            { text: 'Move mine', style: 'cancel' },
            { text: 'Open it', onPress: () => setDuplicateId(existing.internal_id) },
          ],
        );
        return;
      }
      Alert.alert('Not saved', err?.data?.error ?? "That didn't save. Try again in a moment.");
    }
  };

  if (usageLoading || (isEdit && loadingExisting)) {
    return <View style={[styles.fill, styles.center, { backgroundColor: colors.cream }]}><ActivityIndicator color={brand} /></View>;
  }

  // The server enforces this too; this is so nobody writes a description first.
  if (!isEdit && usage?.reached) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: colors.cream, padding: 28 }]}>
        <Lock size={26} color={colors.grey} />
        <Text style={[styles.limitTitle, { color: colors.fg }]}>
          All {usage.limit} of your spots are pinned
        </Text>
        <Text style={[styles.limitBody, { color: colors.grey }]}>
          Remove one to make room, or go Pro to pin as many as you like.
        </Text>
        {onUpsell && (
          <TouchableOpacity
            style={[styles.primary, { backgroundColor: brand }]}
            onPress={onUpsell}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryText}>See Pro</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const mapProps = {
    ref: mapRef as any,
    style: StyleSheet.absoluteFill,
    cameraPosition: camera,
    onMapClick,
    markers: point
      ? [{
          id: 'new',
          coordinates: { latitude: point.lat, longitude: point.lng },
          title: title || 'New spot',
          tintColor: PHOTO_SPOT_PIN_COLOR,
        }]
      : [],
  };

  return (
    <FormScrollView
      style={{ backgroundColor: colors.cream }}
      contentContainerStyle={styles.page}
    >
      <View style={styles.mapWrap}>
        {Platform.OS === 'ios'
          ? <AppleMaps.View {...(mapProps as any)} />
          : <GoogleMaps.View {...(mapProps as any)} uiSettings={{ zoomControlsEnabled: false, mapToolbarEnabled: false }} />}

        <TouchableOpacity
          style={styles.locateBtn}
          onPress={useMyLocation}
          activeOpacity={0.85}
          accessibilityLabel="Use my location"
        >
          {locating
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Crosshair size={16} color="#FFFFFF" />}
        </TouchableOpacity>

        <View pointerEvents="none" style={styles.hint}>
          <Text style={styles.hintText}>
            {point
              ? 'Tap the map again to move it'
              : 'Tap the map to drop your pin'}
          </Text>
        </View>
      </View>

      <Field label="Name" value={title} onChange={setTitle} />

      {/* What kind of place, as one row of chips. Back after coming out: the
          filter wants it, and the badge on the summary is how a spot says
          what it is at a glance. One question, one tap, and skippable. */}
      <FormSection label="What kind of place" optional>
        <View style={styles.chips}>
          {PHOTO_SPOT_TYPES.map((t) => {
            const on = type === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.chip,
                  { borderColor: colors.border, backgroundColor: colors.card },
                  on && { backgroundColor: t.color, borderColor: t.color },
                ]}
                onPress={() => setType(on ? null : t.key)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.chipText, { color: on ? '#000000' : colors.fg }]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </FormSection>

      <FormSection label="Where is it" optional>
        {/* Picking a suggestion moves the pin as well as filling in the name —
            an address is a coordinate, and having typed one it would be odd to
            then ask the member to find the same place on the map. The pin stays
            draggable afterwards, because the spot is usually a specific corner
            of the address rather than its centre. */}
        <AddressField
          value={location}
          onChangeText={setLocation}
          near={point}
          onPlacePicked={(place) => {
            if (place.lat == null || place.lng == null) return;
            setPoint({ lat: place.lat, lng: place.lng });
            look(place.lat, place.lng);
          }}
          inputStyle={[
            styles.input,
            { color: colors.fg, borderColor: colors.border, backgroundColor: colors.card },
          ]}
        />
      </FormSection>

      {/* A name, a kind, a place and a note. Category, best time and access
          notes stayed out: six questions in front of "drop a pin" was why so
          few pins got dropped. The fields still exist on the server, and a
          spot that has them still shows them. */}
      <Field label="Notes" value={body} onChange={setBody} multiline optional />

      <FormSection label="Photos from here">
        <GalleryEditor images={photos} onChange={setPhotos} />
      </FormSection>

      {extraFields}

      {usage?.limit != null && (
        <Text style={[styles.meter, { color: colors.grey }]}>
          {usage.used} of {usage.limit} spots pinned
        </Text>
      )}

      <TouchableOpacity
        style={[styles.primary, { backgroundColor: brand, opacity: saving ? 0.6 : 1 }]}
        onPress={save}
        disabled={saving}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryText}>
          {saving ? (isEdit ? 'Saving…' : 'Pinning…') : (isEdit ? 'Save changes' : 'Pin this spot')}
        </Text>
      </TouchableOpacity>

      {/* The pin that's already here, with its "add your photos" — see duplicateId. */}
      <PhotoSpotSummaryModal spotId={duplicateId} onClose={() => setDuplicateId(null)} />
    </FormScrollView>
  );
}

/**
 * One headed section of the spot form. Exported so a host's `extraFields`
 * (alfa's tag picker) sits in the form as if it were part of it.
 */
export function FormSection({ label, optional, children }: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: colors.fg }]}>
        {label}
        {optional && <Text style={{ color: colors.grey, fontWeight: '400' }}> (optional)</Text>}
      </Text>
      {children}
    </View>
  );
}

function Field({ label, value, onChange, placeholder, multiline, optional }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; optional?: boolean;
}) {
  const colors = useColors();
  return (
    <FormSection label={label} optional={optional}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.grey}
        multiline={multiline}
        style={[
          styles.input,
          { color: colors.fg, borderColor: colors.border, backgroundColor: colors.card },
          multiline && styles.inputTall,
        ]}
      />
    </FormSection>
  );
}

const styles = StyleSheet.create({
  fill:   { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  page:   { padding: 16, paddingBottom: 48, gap: 4 },

  mapWrap: { height: 260, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  locateBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 36, height: 36, borderRadius: COMMON_RADIUS,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  hint: {
    position: 'absolute', left: 10, right: 10, bottom: 10,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  hintText: { color: '#FFFFFF', fontSize: 11, fontFamily: FONT_INTER.semibold, fontVariant: ['tabular-nums'] },

  section: { marginTop: 14 },
  label:   { fontSize: 13, fontFamily: FONT_INTER.bold, marginBottom: 7 },
  chips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:     { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 12.5, fontFamily: FONT_INTER.bold },
  input: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  inputTall: { minHeight: 88, textAlignVertical: 'top' },

  meter: { fontSize: 12, marginTop: 18, textAlign: 'center' },

  primary: {
    marginTop: 12, borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  primaryText: { fontSize: 15, fontFamily: FONT_INTER.extrabold, color: '#000000' },

  limitTitle: { fontSize: 18, fontFamily: FONT_INTER.bold, textAlign: 'center', marginTop: 6 },
  limitBody:  { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
