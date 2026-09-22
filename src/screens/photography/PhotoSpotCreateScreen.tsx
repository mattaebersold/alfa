import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Platform,
  Alert, ActivityIndicator, type LayoutChangeEvent,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import * as Location from 'expo-location';
import { Crosshair, Lock } from 'lucide-react-native';
import PostTagPicker, { type TagItem } from '../../components/social/PostTagPicker';
import AddressField from '../../components/ui/AddressField';
import PostGalleryEditor, { type EditorImage } from '../../components/social/PostGalleryEditor';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import {
  useCreatePhotoSpotMutation, useGetPhotoSpotUsageQuery, useSyncPostTagsMutation,
} from '../../api/apiService';
import {
  spotTypeColor,
} from '../../constants/photoSpots';
import { COMMON_RADIUS } from '../../constants/radius';

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
 */

const DEFAULT_CAMERA = { coordinates: { latitude: 39.5, longitude: -98.35 }, zoom: 3 };

export default function PhotoSpotCreateScreen() {
  const colors = useColors();
  const brand = useBrandColor();
  const nav = useNavigation<any>();
  // The point the member held the map at, when that's how they got here.
  const dropped = (useRoute().params as { lat?: number; lng?: number } | undefined) ?? undefined;
  const droppedPoint = Number.isFinite(dropped?.lat) && Number.isFinite(dropped?.lng)
    ? { lat: dropped!.lat!, lng: dropped!.lng! }
    : null;

  const { data: usage, isLoading: usageLoading } = useGetPhotoSpotUsageQuery();
  const [createSpot, { isLoading: saving }] = useCreatePhotoSpotMutation();
  const [syncTags] = useSyncPostTagsMutation();

  // A held-map pin arrives placed, with the map already on it. It's the spot
  // they chose; asking the GPS where they are would move it somewhere else.
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(droppedPoint);
  const [camera, setCamera] = useState(
    droppedPoint
      ? { coordinates: { latitude: droppedPoint.lat, longitude: droppedPoint.lng }, zoom: 16 }
      : DEFAULT_CAMERA,
  );
  const [locating, setLocating] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [location, setLocation] = useState('');
  const [photos, setPhotos] = useState<EditorImage[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);

  /** Centre the map on the member, and drop the pin there as a starting guess. */
  const useMyLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location is off',
          "Turn on location for Open Road Society to drop a pin where you're standing — or tap the map to place one by hand.",
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
        setCamera({ coordinates: { latitude: next.lat, longitude: next.lng }, zoom: 16 });
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
  }, []);

  const onMapClick = useCallback((e: { coordinates?: { latitude: number; longitude: number } }) => {
    if (!e.coordinates) return;
    setPoint({ lat: e.coordinates.latitude, lng: e.coordinates.longitude });
  }, []);

  const toggleTag = (t: TagItem) =>
    setTags((prev) => prev.some((p) => p.id === t.id && p.kind === t.kind)
      ? prev.filter((p) => !(p.id === t.id && p.kind === t.kind))
      : [...prev, t]);

  const save = async () => {
    if (!point) return Alert.alert('Where is it?', 'Tap the map to drop the pin first.');
    if (!title.trim()) return Alert.alert('Name it', 'Give the spot a name so it reads on the map.');

    const fd = new FormData();
    fd.append('lat', String(point.lat));
    fd.append('lng', String(point.lng));
    fd.append('title', title.trim());
    fd.append('body', body.trim());
    fd.append('location', location.trim());

    // Only the newly picked ones carry a file. A create has nothing else in
    // it, but the editor's type allows both and narrowing here is what keeps
    // this honest if this screen ever grows an edit mode.
    photos.forEach((photo) => {
      if (photo.kind !== 'new') return;
      fd.append('gallery', { uri: photo.uri, name: photo.name, type: photo.type } as any);
    });

    try {
      const { entry } = await createSpot(fd).unwrap();

      /**
       * Tags go up separately, and their failure isn't the spot's.
       *
       * The spot is saved by this point. If tagging fails there is nothing to
       * roll back and nothing useful to say — the member's spot exists, it just
       * doesn't credit the car they meant to credit, which is fixable by
       * editing. Losing the spot over it would not be.
       */
      const ids = (kind: TagItem['kind']) =>
        tags.filter((t) => t.kind === kind).map((t) => t.id);

      if (tags.length > 0) {
        try {
          await syncTags({
            post_id: entry.internal_id,
            entity_type: 'photospot',
            tagged_users: ids('user'),
            tagged_cars: ids('car'),
            tagged_events: ids('event'),
          }).unwrap();
        } catch {
          // Deliberately silent — see above.
        }
      }

      nav.goBack();
    } catch (err: any) {
      Alert.alert('Not saved', err?.data?.error ?? "That didn't save. Try again in a moment.");
    }
  };

  if (usageLoading) {
    return <View style={[styles.fill, styles.center]}><ActivityIndicator color={brand} /></View>;
  }

  // The server enforces this too; this is so nobody writes a description first.
  if (usage?.reached) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: colors.cream, padding: 28 }]}>
        <Lock size={26} color={colors.grey} />
        <Text style={[styles.limitTitle, { color: colors.fg }]}>
          All {usage.limit} of your spots are pinned
        </Text>
        <Text style={[styles.limitBody, { color: colors.grey }]}>
          Remove one to make room, or go Pro to pin as many as you like.
        </Text>
        <TouchableOpacity
          style={[styles.primary, { backgroundColor: brand }]}
          onPress={() => nav.navigate('ProUpsell')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryText}>See Pro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const mapProps = {
    style: StyleSheet.absoluteFill,
    cameraPosition: camera,
    onMapClick,
    markers: point
      ? [{
          id: 'new',
          coordinates: { latitude: point.lat, longitude: point.lng },
          title: title || 'New spot',
          tintColor: spotTypeColor(undefined),
        }]
      : [],
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.cream }}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.mapWrap}>
        {Platform.OS === 'ios'
          ? <AppleMaps.View {...mapProps as any} />
          : <GoogleMaps.View {...mapProps as any} uiSettings={{ zoomControlsEnabled: false, mapToolbarEnabled: false }} />}

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
              ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)} — tap again to move it`
              : 'Tap the map to drop your pin'}
          </Text>
        </View>
      </View>

      <Field label="Name" value={title} onChange={setTitle} />
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.fg }]}>
          Where is it<Text style={{ color: colors.grey, fontWeight: '400' }}> (optional)</Text>
        </Text>
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
            setCamera({ coordinates: { latitude: place.lat, longitude: place.lng }, zoom: 16 });
          }}
          inputStyle={[
            styles.input,
            { color: colors.fg, borderColor: colors.border, backgroundColor: colors.card },
          ]}
        />
      </View>

      {/* Just a name, a place and a note. Type, category, best time and
          access notes came out: six questions in front of "drop a pin" was
          why so few pins got dropped. The fields still exist on the server,
          and a spot that has them still shows them. */}
      <Field label="Notes" value={body} onChange={setBody} multiline optional />

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.fg }]}>Photos from here</Text>
        <PostGalleryEditor images={photos} onChange={setPhotos} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.fg }]}>Tag people, cars and events</Text>
        <PostTagPicker
          users={tags.filter((t) => t.kind === 'user')}
          cars={tags.filter((t) => t.kind === 'car')}
          events={tags.filter((t) => t.kind === 'event')}
          onToggle={toggleTag}
        />
      </View>

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
        <Text style={styles.primaryText}>{saving ? 'Pinning…' : 'Pin this spot'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, value, onChange, placeholder, multiline, optional }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; optional?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: colors.fg }]}>
        {label}
        {optional && <Text style={{ color: colors.grey, fontWeight: '400' }}> (optional)</Text>}
      </Text>
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
    </View>
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
  hintText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },

  section: { marginTop: 14 },
  label:   { fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  inputTall: { minHeight: 88, textAlignVertical: 'top' },

  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
  },
  optionText: { fontSize: 13, fontWeight: '700' },

  meter: { fontSize: 12, marginTop: 18, textAlign: 'center' },

  primary: {
    marginTop: 12, borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  primaryText: { fontSize: 15, fontWeight: '800', color: '#000000' },

  limitTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  limitBody:  { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
