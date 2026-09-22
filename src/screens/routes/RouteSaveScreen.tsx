import React, { useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RouteMap from '../../components/routes/RouteMap';
import PostTagPicker, { type TagItem } from '../../components/social/PostTagPicker';
import PostToSelector from '../../components/social/PostToSelector';
import Spinner from '../../components/ui/Spinner';
import { DateField } from '../../components/ui/DateTimeField';
import { readDraft, clearDraft } from '../../hooks/useRouteRecorder';
import {
  useCreateRouteMutation,
  useUpdateRouteMutation,
  useGetRouteQuery,
  useGetPostTagsQuery,
  useSyncPostTagsMutation,
  useGetRouteEndpointNamesQuery,
  useGetUserGroupsQuery,
  useGetPreviouslyTaggedUsersQuery,
  useGetPreviouslyTaggedCarsQuery,
  useGetPreviouslyTaggedEventsQuery,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import {
  formatDistance, formatDuration, formatSpeed, compactSamples, decodePolyline, curvinessLabel,
} from '../../utils/routeGeometry';
import { isPlottedRoute } from '../../types/api';
import { colors as palette } from '../../constants/colors';
import type { AppStackParamList } from '../../navigation/types';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';

type NavProp = NativeStackNavigationProp<AppStackParamList>;
type SaveRoute = RouteProp<AppStackParamList, 'RouteSave'>;

/**
 * Kept against the surface picker coming back — the model and the route filters
 * both still understand these, only the input is hidden. See `surface` below.
 */
export const SURFACES = [
  { key: 'paved', label: 'Paved' },
  { key: 'mixed', label: 'Mixed' },
  { key: 'dirt', label: 'Dirt' },
] as const;

/**
 * Save-or-discard, shown once a drive is finished — and the edit form for a
 * route already saved.
 *
 * One screen for all of them, the way the post form is, so tagging and
 * sharing to groups can't drift apart between creating a route and fixing
 * one. The difference is where the shape comes from: a new drive reads its
 * track back from the on-disk draft, a plotted drive arrives with the path
 * the plotting screen drew, an edit draws the saved route's polyline. The
 * shape itself is never editable here — a route's numbers are the ones its
 * drive (or its plot) produced.
 *
 * A plotted route has no time, speed or elevation, and the form doesn't
 * pretend otherwise: it shows the distance, says "Plotted", and offers a day
 * the drive happened — a day, nothing finer. Nothing typed here can become a
 * number that recorded drives have to earn.
 *
 * For a new drive the track is read from disk rather than passed through
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
  const { params } = useRoute<SaveRoute>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const brand = useBrandColor();
  const onBrand = contrastText(brand);
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);

  const editId = params?.routeId;
  const isEdit = !!editId;
  /** A plotted drive, with the path the plotting screen drew. */
  const plot = params?.plot ?? null;
  const isPlot = !!plot;

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Route' : 'Save Route' });
  }, [navigation, isEdit]);

  const [createRoute, { isLoading: creating }] = useCreateRouteMutation();
  const [updateRoute, { isLoading: updating }] = useUpdateRouteMutation();
  const [syncTags, { isLoading: syncing }] = useSyncPostTagsMutation();
  const isLoading = creating || updating || syncing;

  const draft = useMemo(() => (isEdit || isPlot ? null : readDraft()), [isEdit, isPlot]);
  const { data: existing, isLoading: loadingExisting } = useGetRouteQuery(editId ?? '', { skip: !isEdit });
  const { data: existingTags } = useGetPostTagsQuery(editId ?? '', { skip: !isEdit });

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [technical, setTechnical] = useState<number | null>(null);
  const [startPlace, setStartPlace] = useState('');
  const [endPlace, setEndPlace] = useState('');
  /** "YYYY-MM-DD", plotted routes only. Empty means unsaid. */
  const [drivenOn, setDrivenOn] = useState('');
  /**
   * Surface is hidden for now — every route recorded so far is a paved road, and
   * a three-way choice nobody varies is a field people learn to skip. The value
   * still goes up so the column keeps its meaning, and the picker is one block
   * away from coming back when there are dirt drives worth filtering for.
   */
  const surface = 'paved';
  const [isPrivate, setIsPrivate] = useState(false);

  const [taggedUsers, setTaggedUsers] = useState<TagItem[]>([]);
  const [taggedCars, setTaggedCars] = useState<TagItem[]>([]);
  const [taggedEvents, setTaggedEvents] = useState<TagItem[]>([]);

  /**
   * Where the route goes, chosen exactly as a post's is: publicly, into groups,
   * or both. Groups used to be a row in the tag picker, which tagged the group
   * rather than posting into it — the route turned up in the group's list but
   * couldn't be kept out of the public one. The server now stores these the
   * way it stores a post's.
   */
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const { data: myGroups } = useGetUserGroupsQuery(myId ?? '', { skip: !myId });
  const userGroups = (myGroups ?? []).filter((g) => (g.membership?.status ?? 'active') === 'active');

  /**
   * Groups the route is already in that the list above doesn't have — one you
   * have since left, or someone else's group when an admin is editing. Offered
   * as tiles too, so saving doesn't quietly drop them.
   */
  const selectorGroups = useMemo(() => {
    const known = new Set(userGroups.map((g) => g.internal_id));
    const extra = selectedGroupIds
      .filter((id) => !known.has(id))
      .map((id) => ({ internal_id: id, title: 'Group' }));
    return [...userGroups, ...extra];
  }, [userGroups, selectedGroupIds]);

  // ── Edit: prefill once the saved route arrives ──────────────────────────────

  const prefilledEdit = useRef(false);
  useEffect(() => {
    if (!isEdit || !existing || prefilledEdit.current) return;
    prefilledEdit.current = true;
    const e = existing.entry;
    setTitle(e.title ?? '');
    setBody(e.body ?? '');
    setTechnical(e.technical_rating ?? null);
    setStartPlace(e.start_place ?? '');
    setEndPlace(e.end_place ?? '');
    setDrivenOn(e.driven_on ? String(e.driven_on).slice(0, 10) : '');
    setIsPrivate(!!e.private);
    setSelectedGroupIds(e.group_ids ?? []);
    // No groups means public; with groups, public is its own choice.
    setIsPublic(e.group_ids?.length ? !!e.also_public : true);
  }, [isEdit, existing]);

  /**
   * Readable names for the tags already on the route. The tag records carry
   * ids only, so the names come from the previously-tagged pools — which include
   * this member's routes — the same way the post editor resolves them. Anything
   * not in a pool keeps a plain placeholder; the tag itself is intact either way.
   */
  const { data: prevUsers } = useGetPreviouslyTaggedUsersQuery(undefined, { skip: !isEdit });
  const { data: prevCars } = useGetPreviouslyTaggedCarsQuery(undefined, { skip: !isEdit });
  const { data: prevEvents } = useGetPreviouslyTaggedEventsQuery(undefined, { skip: !isEdit });
  const labels = useMemo(() => {
    const map: Record<string, string> = {};
    (prevUsers?.users ?? []).forEach((u: any) => {
      const id = u.user_id || u.internal_id;
      if (id && u.username) map[id] = `@${u.username}`;
    });
    (prevCars?.cars ?? []).forEach((c: any) => {
      if (c.internal_id) map[c.internal_id] = [c.year, c.make, c.model].filter(Boolean).join(' ') || c.title || 'Car';
    });
    (prevEvents?.events ?? []).forEach((ev: any) => {
      if (ev.internal_id) map[ev.internal_id] = ev.title || 'Event';
    });
    return map;
  }, [prevUsers, prevCars, prevEvents]);

  const prefilledTags = useRef(false);
  useEffect(() => {
    if (!isEdit || !existingTags || !existing || prefilledTags.current) return;
    prefilledTags.current = true;
    const users: TagItem[] = [];
    const cars: TagItem[] = [];
    const events: TagItem[] = [];
    existingTags.forEach((t) => {
      const id = t.tag_internal_id;
      if (t.tag_entry_type === 'user') users.push({ id, kind: 'user', label: labels[id] ?? 'Tagged member' });
      else if (t.tag_entry_type === 'garagecar' || t.tag_entry_type === 'car') cars.push({ id, kind: 'car', label: labels[id] ?? 'Tagged car' });
      else if (t.tag_entry_type === 'event') events.push({ id, kind: 'event', label: labels[id] ?? 'Tagged event' });
    });
    // A route from before car tagging has its car on `car_id` alone. Putting
    // it first keeps it "the car I drove" when the form is saved.
    const carId = existing.entry.car_id;
    if (carId && !cars.some((c) => c.id === carId)) {
      cars.unshift({ id: carId, kind: 'car', label: labels[carId] ?? 'Tagged car' });
    }
    setTaggedUsers(users);
    setTaggedCars(cars);
    setTaggedEvents(events);
  }, [isEdit, existingTags, existing, labels]);

  // Names land after the tags do; swap them in without touching the selection.
  useEffect(() => {
    const relabel = (list: TagItem[]) =>
      list.some((t) => labels[t.id] && labels[t.id] !== t.label)
        ? list.map((t) => (labels[t.id] ? { ...t, label: labels[t.id] } : t))
        : list;
    setTaggedUsers(relabel);
    setTaggedCars(relabel);
    setTaggedEvents(relabel);
  }, [labels]);

  // ── New drive: suggested endpoint names ─────────────────────────────────────

  /**
   * Suggested names for the two ends, so the fields open filled in rather than
   * empty. Only a suggestion — both are editable, and the drive saves fine if
   * the lookup comes back with nothing.
   */
  const firstSample = draft?.samples?.[0] ?? plot?.waypoints[0];
  const lastSample = draft?.samples?.[draft.samples.length - 1] ?? plot?.waypoints[plot.waypoints.length - 1];
  const { data: placeNames } = useGetRouteEndpointNamesQuery(
    {
      start_lat: firstSample?.lat as number,
      start_lng: firstSample?.lng as number,
      end_lat: lastSample?.lat as number,
      end_lng: lastSample?.lng as number,
    },
    { skip: !firstSample || !lastSample },
  );

  // Prefill once, and never over something already typed — the lookup can land
  // after the driver has started filling the form in.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !placeNames) return;
    prefilled.current = true;
    setStartPlace((v) => v || placeNames.start || '');
    setEndPlace((v) => v || placeNames.end || '');
  }, [placeNames]);

  const toggleTag = (item: TagItem) => {
    // Groups are chosen under "Post To", not tagged — the picker isn't given a
    // groups row here, so it never emits one.
    if (item.kind === 'group') return;
    const [list, setList] =
      item.kind === 'user' ? [taggedUsers, setTaggedUsers] as const
      : item.kind === 'car' ? [taggedCars, setTaggedCars] as const
      : [taggedEvents, setTaggedEvents] as const;
    setList(list.some((t) => t.id === item.id)
      ? list.filter((t) => t.id !== item.id)
      : [...list, item]);
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]);
  };

  // ── The shape and its numbers ───────────────────────────────────────────────

  const path = useMemo(() => {
    if (isEdit) return existing?.entry.polyline ? decodePolyline(existing.entry.polyline) : [];
    if (plot) return decodePolyline(plot.polyline);
    return (draft?.samples ?? []).map((s) => ({ lat: s.lat, lng: s.lng }));
  }, [isEdit, existing, draft, plot]);
  const pathSpeeds = useMemo(() => {
    if (isEdit) return existing?.entry.speed_profile ?? [];
    if (plot) return [];
    return (draft?.samples ?? []).map((s) => Math.max(0, s.speed));
  }, [isEdit, existing, draft, plot]);

  /** Whether the route being shown has no timed numbers to print. */
  const plotted = isPlot || (isEdit && isPlottedRoute(existing?.entry));

  const pitStops = isEdit ? existing?.entry.pit_stops : draft?.pitStops;

  // Rough preview numbers, good enough to confirm the right drive was captured.
  // An edit shows the stored ones, which are the real thing.
  const preview = useMemo(() => {
    if (isEdit) {
      const stats = existing?.entry.stats;
      return stats
        ? { distance: stats.distance_meters, duration: stats.moving_ms || stats.duration_ms, maxSpeed: stats.max_speed, curviness: stats.curviness }
        : null;
    }
    if (plot) return { distance: plot.distance_meters, duration: 0, maxSpeed: 0, curviness: plot.curviness };
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
    return { distance, duration: last.t - first.t, maxSpeed, curviness: 0 };
  }, [isEdit, existing, draft, plot]);

  const discard = () => {
    if (isEdit) {
      navigation.goBack();
      return;
    }
    if (isPlot) {
      // Back to the pins, which are still on the plotting screen.
      navigation.goBack();
      return;
    }
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

  /** Group fields, shared by create and update. A private route goes nowhere. */
  const appendGroups = (fd: FormData) => {
    const groups = isPrivate ? [] : selectedGroupIds;
    // Always sent on an edit — an empty list is how groups get removed.
    if (groups.length || isEdit) fd.append('group_ids', JSON.stringify(groups));
    fd.append('also_public', groups.length && !isPublic ? 'false' : 'true');
  };

  /**
   * Tags are a separate write, and a failure there shouldn't lose the route —
   * so it's reported, not rolled back.
   *
   * `tagged_groups` is sent empty on purpose. Groups travel with the route
   * itself now (`group_ids`); the sync clearing any old group tags is what
   * finishes moving an early route over, once its groups are in `group_ids`.
   */
  const applyTags = async (routeId: string) => {
    const any = taggedUsers.length || taggedCars.length || taggedEvents.length;
    if (!isEdit && !any) return true;
    try {
      await syncTags({
        post_id: routeId,
        entity_type: 'route',
        tagged_users: taggedUsers.map((t) => t.id),
        tagged_cars: taggedCars.map((t) => t.id),
        tagged_events: taggedEvents.map((t) => t.id),
        tagged_groups: [],
      }).unwrap();
      return true;
    } catch {
      return false;
    }
  };

  const saveEdit = async () => {
    if (!editId) return;
    const fd = new FormData();
    fd.append('internal_id', editId);
    fd.append('title', title.trim());
    fd.append('body', body.trim());
    fd.append('start_place', startPlace.trim());
    fd.append('end_place', endPlace.trim());
    fd.append('technical_rating', technical ? String(technical) : '');
    fd.append('private', isPrivate ? 'true' : 'false');
    if (plotted) fd.append('driven_on', drivenOn);
    // The first tagged car is "the car I drove", as on a new route.
    fd.append('car_id', taggedCars[0]?.id ?? '');
    appendGroups(fd);

    try {
      await updateRoute(fd).unwrap();
    } catch (e: any) {
      Alert.alert('Save failed', e?.data?.error ?? 'Could not save your changes. Please try again.');
      return;
    }

    if (!(await applyTags(editId))) {
      Alert.alert('Route saved', 'Your changes were saved, but the tags could not be updated.');
    }
    navigation.goBack();
  };

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Name this route', 'Give the route a title so people can find it.');
      return;
    }
    if (isEdit) {
      await saveEdit();
      return;
    }
    if (!plot && !draft?.samples?.length) {
      Alert.alert('No track found', 'The recording could not be read back.');
      return;
    }

    const fd = new FormData();
    fd.append('title', title.trim());
    if (body.trim()) fd.append('body', body.trim());
    // The shape: pins for a plotted drive, the track for a recorded one. The
    // server redraws the roads through the pins itself rather than trusting
    // the path this screen was handed.
    if (plot) {
      fd.append('waypoints', JSON.stringify(plot.waypoints));
      if (drivenOn) fd.append('driven_on', drivenOn);
    } else {
      fd.append('samples', JSON.stringify(compactSamples(draft!.samples)));
    }
    fd.append('surface', surface);
    if (startPlace.trim()) fd.append('start_place', startPlace.trim());
    if (endPlace.trim()) fd.append('end_place', endPlace.trim());
    if (draft?.pitStops?.length) fd.append('pit_stops', JSON.stringify(draft.pitStops));
    if (technical) fd.append('technical_rating', String(technical));
    if (isPrivate) fd.append('private', 'true');
    // The first tagged car doubles as "the car I drove" — the route's own
    // association — while still being recorded as a tag like the others.
    if (taggedCars[0]) fd.append('car_id', taggedCars[0].id);
    appendGroups(fd);

    try {
      const created = await createRoute(fd).unwrap();

      if (created?.internal_id && !(await applyTags(created.internal_id))) {
        Alert.alert('Route saved', 'The route was saved, but its tags could not be applied.');
      }

      if (plot) {
        // Past the plotting screen too — the route is saved, the pins are done.
        navigation.pop(2);
      } else {
        clearDraft();
        navigation.goBack();
      }
    } catch (e: any) {
      // The draft is deliberately left on disk here. Whatever went wrong, the
      // drive itself is the irreplaceable part — it can't be re-driven — and
      // the record screen offers it back the next time it's opened.
      const offline = e?.status === 'FETCH_ERROR' || e?.status === 'TIMEOUT_ERROR';
      if (offline && !plot) {
        Alert.alert(
          "You're offline",
          "This drive is saved on your phone — nothing is lost. Open Record a Route once you have a connection and choose \"Finish it\" to upload it.",
        );
        return;
      }
      // The API rejects short or unusable tracks with a specific reason —
      // surfacing it beats a generic failure message.
      const message = e?.data?.error ?? 'Could not save this route. Please try again.';
      Alert.alert('Save failed', message);
    }
  };

  if (isEdit && loadingExisting) return <Spinner />;

  if (isEdit ? !existing : !(draft || plot)) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={[styles.emptyTitle, { color: colors.fg }]}>
          {isEdit ? 'Route not found' : 'No recording found'}
        </Text>
        <Text style={[styles.emptyBody, { color: colors.grey }]}>
          {isEdit
            ? 'This route could not be loaded. It may have been deleted.'
            : 'The drive could not be read back from storage.'}
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

        {pitStops?.length ? (
          <Text style={[styles.pitSummary, { color: colors.grey }]}>
            {pitStops.length} pit stop{pitStops.length === 1 ? '' : 's'}: {' '}
            {pitStops.map((p) => p.label).filter(Boolean).join(' · ')}
          </Text>
        ) : null}

        {preview && (
          <View style={[styles.statsRow, { borderBottomColor: colors.border }]}>
            <Stat label="Distance" value={formatDistance(preview.distance)} colors={colors} />
            {plotted ? (
              // No time, no speed: nothing was there to measure them. What a
              // path can say is how it bends.
              <>
                <Stat label="Curves" value={curvinessLabel(preview.curviness)} colors={colors} />
                <Stat label="Source" value="Plotted" colors={colors} />
              </>
            ) : (
              <>
                <Stat label="Time" value={formatDuration(preview.duration)} colors={colors} />
                <Stat label="Top speed" value={formatSpeed(preview.maxSpeed)} colors={colors} />
              </>
            )}
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

          {/* Where it began and ended. Prefilled from the track, editable —
              these are what the route's itinerary is built from, and they read
              better as "Iron Springs" than as a pair of coordinates. */}
          <Field label="Start">
            <TextInput
              style={[styles.input, { color: colors.fg, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
              value={startPlace}
              onChangeText={setStartPlace}
              placeholder="Where the drive began"
              placeholderTextColor={colors.grey}
              maxLength={80}
            />
          </Field>

          <Field label="End">
            <TextInput
              style={[styles.input, { color: colors.fg, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
              value={endPlace}
              onChangeText={setEndPlace}
              placeholder="Where it finished"
              placeholderTextColor={colors.grey}
              maxLength={80}
            />
          </Field>

          {/* Plotted routes only. A day, not a time — plotted from memory,
              nobody knows the minute — and never a duration or a speed, which
              would be numbers a recorded drive had to earn. */}
          {plotted && (
            <Field label="When did you drive it?">
              <DateField
                value={drivenOn}
                onChange={setDrivenOn}
                placeholder="Optional"
                clearable
                maximumDate={new Date()}
              />
            </Field>
          )}

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
              {plotted
                ? 'Your rating sits alongside a curviness score we calculate from the road.'
                : 'Your rating sits alongside a curviness score we calculate from the GPS track.'}
            </Text>
          </Field>

          {/* The same picker a post uses. On a route the people are who drove
              it and the first car is the one it was driven in, which is how the
              route's page labels them. */}
          <View style={[styles.tagSection, { borderTopColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.fg }]}>Tag Drivers, Cars & Events</Text>
            <PostTagPicker
              users={taggedUsers}
              cars={taggedCars}
              events={taggedEvents}
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

          {/* Hidden while private rather than disabled: a private route can't
              be anywhere else, so there's no choice here to make. */}
          {!isPrivate && (
            <View style={[styles.postToCard, { backgroundColor: colors.card, borderColor: colors.borderDark }]}>
              <Text style={[styles.fieldLabel, { color: colors.fg, marginBottom: 12 }]}>Post To</Text>
              <PostToSelector
                isPublic={isPublic}
                onTogglePublic={() => setIsPublic((v) => !v)}
                groups={selectorGroups}
                selectedGroupIds={selectedGroupIds}
                onToggleGroup={toggleGroup}
              />
              {selectorGroups.length === 0 ? (
                <Text style={[styles.helper, { color: colors.grey, marginTop: 10 }]}>
                  You're not a member of any groups yet.
                </Text>
              ) : selectedGroupIds.length > 0 && !isPublic ? (
                <Text style={[styles.helper, { color: colors.grey, marginTop: 10 }]}>
                  Only members of the selected groups will see this route.
                </Text>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.actions, { backgroundColor: colors.card, paddingBottom: insets.bottom + 12, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: isEdit ? colors.border : palette.red }]}
          onPress={discard}
          disabled={isLoading}
        >
          <Text style={[styles.secondaryLabel, { color: isEdit ? colors.fg : palette.red }]}>
            {isEdit ? 'Cancel' : 'Discard'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: brand, flex: 1 }]}
          onPress={save}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color={onBrand} />
            : <Text style={[styles.primaryLabel, { color: onBrand }]}>{isEdit ? 'Save Changes' : 'Save Route'}</Text>}
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
  ratingPill:  { width: 48, height: 44, borderRadius: PILL_RADIUS, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  surfacePill: { paddingHorizontal: 18, height: 44, borderRadius: PILL_RADIUS, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  pillText:    { fontSize: 15, fontWeight: '700' },

  tagSection:  { paddingTop: 18, borderTopWidth: 1, gap: 4, marginHorizontal: -16, paddingHorizontal: 16 },
  switchRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 18, borderTopWidth: 1 },
  switchLabel: { fontSize: 15, fontWeight: '700' },
  // The same card the post form puts its "Post To" choice in.
  postToCard:  { borderWidth: 1, borderRadius: COMMON_RADIUS, padding: 14 },

  actions: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1,
  },
  primaryBtn:     { height: 52, borderRadius: COMMON_RADIUS, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  primaryLabel:   { fontSize: 16, fontWeight: '800' },
  secondaryBtn:   { height: 52, borderRadius: COMMON_RADIUS, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  secondaryLabel: { fontSize: 16, fontWeight: '700' },
});
