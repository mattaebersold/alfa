import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RouteMap from '../../components/routes/RouteMap';
import PostTagPicker, { type TagItem } from '../../components/social/PostTagPicker';
import { readDraft, clearDraft } from '../../hooks/useRouteRecorder';
import { useCreateRouteMutation, useSyncPostTagsMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import { formatDistance, formatDuration, formatSpeed, compactSamples } from '../../utils/routeGeometry';
import { colors as palette } from '../../constants/colors';
import type { AppStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const SURFACES = [
  { key: 'paved', label: 'Paved' },
  { key: 'mixed', label: 'Mixed' },
  { key: 'dirt', label: 'Dirt' },
] as const;

/**
 * Save-or-discard, shown once a drive is finished.
 *
 * The track is read back from the on-disk draft rather than passed through
 * navigation params — it's thousands of points, far too much to put in a
 * route param, and reading from disk is also what makes recovery-after-crash
 * work with the same code path.
 *
 * Only the description-ish fields are collected here. Every number shown is
 * the client's live estimate; the server recomputes them all from the track on
 * save, and its answer is what gets stored.
 */
export default function RouteSaveScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const brand = useBrandColor();
  const onBrand = contrastText(brand);

  const [createRoute, { isLoading }] = useCreateRouteMutation();
  const [syncTags] = useSyncPostTagsMutation();

  const draft = useMemo(() => readDraft(), []);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [technical, setTechnical] = useState<number | null>(null);
  const [surface, setSurface] = useState<string>('paved');
  const [isPrivate, setIsPrivate] = useState(false);

  const [taggedUsers, setTaggedUsers] = useState<TagItem[]>([]);
  const [taggedCars, setTaggedCars] = useState<TagItem[]>([]);
  const [taggedEvents, setTaggedEvents] = useState<TagItem[]>([]);
  const [taggedGroups, setTaggedGroups] = useState<TagItem[]>([]);

  const toggleTag = (item: TagItem) => {
    const [list, setList] =
      item.kind === 'user' ? [taggedUsers, setTaggedUsers] as const
      : item.kind === 'car' ? [taggedCars, setTaggedCars] as const
      : item.kind === 'group' ? [taggedGroups, setTaggedGroups] as const
      : [taggedEvents, setTaggedEvents] as const;
    setList(list.some((t) => t.id === item.id)
      ? list.filter((t) => t.id !== item.id)
      : [...list, item]);
  };

  const path = useMemo(
    () => (draft?.samples ?? []).map((s) => ({ lat: s.lat, lng: s.lng })),
    [draft],
  );
  const pathSpeeds = useMemo(
    () => (draft?.samples ?? []).map((s) => Math.max(0, s.speed)),
    [draft],
  );

  // Rough preview numbers, good enough to confirm the right drive was captured.
  const preview = useMemo(() => {
    if (!draft?.samples?.length) return null;
    const first = draft.samples[0];
    const last = draft.samples[draft.samples.length - 1];
    let distance = 0;
    let maxSpeed = 0;
    for (let i = 1; i < draft.samples.length; i++) {
      const a = draft.samples[i - 1];
      const b = draft.samples[i];
      if (b.speed > 1) {
        const dLat = ((b.lat - a.lat) * Math.PI) / 180;
        const dLng = ((b.lng - a.lng) * Math.PI) / 180;
        const h = Math.sin(dLat / 2) ** 2 +
          Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        distance += 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
        if (b.speed > maxSpeed) maxSpeed = b.speed;
      }
    }
    return { distance, duration: last.t - first.t, maxSpeed };
  }, [draft]);

  const discard = () => {
    Alert.alert('Discard route?', 'This drive will be deleted.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          clearDraft();
          navigation.goBack();
        },
      },
    ]);
  };

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Name this route', 'Give the route a title so people can find it.');
      return;
    }
    if (!draft?.samples?.length) {
      Alert.alert('No track found', 'The recording could not be read back.');
      return;
    }

    const fd = new FormData();
    fd.append('title', title.trim());
    if (body.trim()) fd.append('body', body.trim());
    fd.append('samples', JSON.stringify(compactSamples(draft.samples)));
    fd.append('surface', surface);
    if (draft.pitStops?.length) fd.append('pit_stops', JSON.stringify(draft.pitStops));
    if (technical) fd.append('technical_rating', String(technical));
    if (isPrivate) fd.append('private', 'true');
    // The first tagged car doubles as "the car I drove" — the route's own
    // association — while still being recorded as a tag like the others.
    if (taggedCars[0]) fd.append('car_id', taggedCars[0].id);

    try {
      const created = await createRoute(fd).unwrap();

      // Tags are a separate write, and a failure there shouldn't lose the
      // route the person just drove — so it's reported, not rolled back.
      if (created?.internal_id
        && (taggedUsers.length || taggedCars.length || taggedEvents.length || taggedGroups.length)) {
        try {
          await syncTags({
            post_id: created.internal_id,
            entity_type: 'route',
            tagged_users: taggedUsers.map((t) => t.id),
            tagged_cars: taggedCars.map((t) => t.id),
            tagged_events: taggedEvents.map((t) => t.id),
            tagged_groups: taggedGroups.map((t) => t.id),
          }).unwrap();
        } catch {
          Alert.alert('Route saved', 'The route was saved, but its tags could not be applied.');
        }
      }

      clearDraft();
      navigation.goBack();
    } catch (e: any) {
      // The API rejects short or unusable tracks with a specific reason —
      // surfacing it beats a generic failure message.
      const message = e?.data?.error ?? 'Could not save this route. Please try again.';
      Alert.alert('Save failed', message);
    }
  };

  if (!draft) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={[styles.emptyTitle, { color: colors.fg }]}>No recording found</Text>
        <Text style={[styles.emptyBody, { color: colors.grey }]}>
          The drive could not be read back from storage.
        </Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: brand, marginTop: 20 }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.primaryLabel, { color: onBrand }]}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled">
        <View style={styles.mapWrap}>
          <RouteMap path={path} speeds={pathSpeeds} color={brand} style={StyleSheet.absoluteFill} />
        </View>

        {draft.pitStops?.length ? (
          <Text style={[styles.pitSummary, { color: colors.grey }]}>
            {draft.pitStops.length} pit stop{draft.pitStops.length === 1 ? '' : 's'}: {' '}
            {draft.pitStops.map((p) => p.label).filter(Boolean).join(' · ')}
          </Text>
        ) : null}

        {preview && (
          <View style={[styles.statsRow, { borderBottomColor: colors.border }]}>
            <Stat label="Distance" value={formatDistance(preview.distance)} colors={colors} />
            <Stat label="Time" value={formatDuration(preview.duration)} colors={colors} />
            <Stat label="Top speed" value={formatSpeed(preview.maxSpeed)} colors={colors} />
          </View>
        )}

        <View style={styles.form}>
          <Field label="Route name">
            <TextInput
              style={[styles.input, { color: colors.fg, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Skyline Drive, north to south"
              placeholderTextColor={colors.grey}
              maxLength={120}
            />
          </Field>

          <Field label="Description">
            <TextInput
              style={[styles.input, styles.textarea, { color: colors.fg, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
              value={body}
              onChangeText={setBody}
              placeholder="What makes this road worth driving?"
              placeholderTextColor={colors.grey}
              multiline
              textAlignVertical="top"
            />
          </Field>

          <Field label="How technical was it?">
            <View style={styles.pillRow}>
              {[1, 2, 3, 4, 5].map((n) => {
                const active = technical === n;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[
                      styles.ratingPill,
                      { borderColor: colors.border },
                      active && { backgroundColor: brand, borderColor: brand },
                    ]}
                    onPress={() => setTechnical(active ? null : n)}
                  >
                    <Text style={[styles.pillText, { color: active ? onBrand : colors.fg }]}>{n}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.helper, { color: colors.grey }]}>
              Your rating sits alongside a curviness score we calculate from the GPS track.
            </Text>
          </Field>

          <Field label="Surface">
            <View style={styles.pillRow}>
              {SURFACES.map((s) => {
                const active = surface === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[
                      styles.surfacePill,
                      { borderColor: colors.border },
                      active && { backgroundColor: brand, borderColor: brand },
                    ]}
                    onPress={() => setSurface(s.key)}
                  >
                    <Text style={[styles.pillText, { color: active ? onBrand : colors.fg }]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          <View style={[styles.tagSection, { borderTopColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.fg }]}>Tag People, Cars, Events & Groups</Text>
            <PostTagPicker
              users={taggedUsers}
              cars={taggedCars}
              events={taggedEvents}
              groups={taggedGroups}
              onToggle={toggleTag}
            />
          </View>

          <View style={[styles.switchRow, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchLabel, { color: colors.fg }]}>Keep private</Text>
              <Text style={[styles.helper, { color: colors.grey }]}>
                Only you will see this route.
              </Text>
            </View>
            <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ true: brand }} />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.actions, { backgroundColor: colors.card, paddingBottom: insets.bottom + 12, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: palette.red }]}
          onPress={discard}
          disabled={isLoading}
        >
          <Text style={[styles.secondaryLabel, { color: palette.red }]}>Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: brand, flex: 1 }]}
          onPress={save}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color={onBrand} />
            : <Text style={[styles.primaryLabel, { color: onBrand }]}>Save Route</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.fg }]}>{label}</Text>
      {children}
    </View>
  );
}

function Stat({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.fg }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.grey }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyBody:  { fontSize: 14, textAlign: 'center', marginTop: 8 },

  mapWrap:   { height: 240, width: '100%', position: 'relative' },

  statsRow:  { flexDirection: 'row', paddingVertical: 16, borderBottomWidth: 1 },
  stat:      { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  pitSummary: { fontSize: 12, paddingHorizontal: 16, paddingTop: 12 },
  form:       { padding: 16, gap: 20 },
  field:      { gap: 8 },
  fieldLabel: { fontSize: 14, fontWeight: '700' },
  input:      { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  textarea:   { minHeight: 96 },
  helper:     { fontSize: 12, lineHeight: 16 },

  pillRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  ratingPill:  { width: 48, height: 44, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  surfacePill: { paddingHorizontal: 18, height: 44, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  pillText:    { fontSize: 15, fontWeight: '700' },

  tagSection:  { paddingTop: 18, borderTopWidth: 1, gap: 4, marginHorizontal: -16, paddingHorizontal: 16 },
  switchRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 18, borderTopWidth: 1 },
  switchLabel: { fontSize: 15, fontWeight: '700' },

  actions: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1,
  },
  primaryBtn:     { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  primaryLabel:   { fontSize: 16, fontWeight: '800' },
  secondaryBtn:   { height: 52, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  secondaryLabel: { fontSize: 16, fontWeight: '700' },
});
