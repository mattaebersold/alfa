import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Undo2, Flag, MapPin, ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import RouteMap, { type LatLng } from '../../components/routes/RouteMap';
import { usePlotRouteMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, useIsPro, contrastText } from '../../hooks/useBrandColor';
import { decodePolyline, formatDistance, haversine, curvinessLabel } from '../../utils/routeGeometry';
import type { AppStackParamList } from '../../navigation/types';
import type { RoutePlotPreview } from '../../types/api';
import { COMMON_RADIUS } from '../../constants/radius';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

/** Start, finish, and this many roads to pull the path through. */
const MAX_VIAS = 10;
/** How long the pins sit still before the roads are asked for. */
const PLOT_DEBOUNCE_MS = 450;
/** Where the map opens with no fix: the country. Zoom 3 is all of it. */
const DEFAULT_CENTER: LatLng = { lat: 39.5, lng: -98.35 };
const HERE_ZOOM = 11;

const START_COLOR = '#2E9E4F';
const FINISH_COLOR = '#E23B3B';

/**
 * Plotting a drive you've already done.
 *
 * Recording is the honest way to make a route — the phone was there — but
 * plenty of drives happen with the phone in a pocket, and a road worth
 * sharing shouldn't be lost to that. So: tap where the drive started, tap
 * where it finished, and the roads between are drawn. The catch, and the
 * reason for every tap after the second, is that the drawn path is the
 * *quickest* one and the drive you took usually wasn't. Tapping a road pulls
 * the path through it — "no, over the pass, not the freeway" — and two or
 * three of those pin down almost any drive.
 *
 * Every pin change asks the server for the roads again, debounced so a run
 * of quick taps costs one request. The path comes back with a distance; that
 * and the shape are the only numbers a plotted route gets. There's no
 * duration, no speed, no elevation — nothing was there to measure them, and
 * the save form says so rather than inventing them.
 *
 * Pro-only, as recording is. The screen is reachable only from a Pro entry
 * point, but a member who arrives some other way is told rather than let
 * fail at the save.
 */
export default function RoutePlotScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const brand = useBrandColor();
  const onBrand = contrastText(brand);
  const isPro = useIsPro();

  useEffect(() => {
    if (!isPro) {
      Alert.alert(
        'Pro membership required',
        'Plotting routes is a Pro member feature.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    }
  }, [isPro, navigation]);

  // The camera is set once, to where the member is, and then left alone —
  // a plotted drive is usually near home, and a map that kept recentring
  // would fight the panning this screen is all about.
  const [center, setCenter] = useState<{ point: LatLng; zoom: number } | null>(null);
  // Only shown with the grant in hand — without it the dot never appears.
  const [locationGranted, setLocationGranted] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('no permission');
        if (!cancelled) setLocationGranted(true);
        const fix = (await Location.getLastKnownPositionAsync())
          ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (!cancelled && fix) {
          setCenter({ point: { lat: fix.coords.latitude, lng: fix.coords.longitude }, zoom: HERE_ZOOM });
          return;
        }
      } catch {
        // Fall through to the country view.
      }
      if (!cancelled) setCenter({ point: DEFAULT_CENTER, zoom: 3 });
    })();
    return () => { cancelled = true; };
  }, []);

  /** In order: start, the roads pulled through, finish. */
  const [waypoints, setWaypoints] = useState<LatLng[]>([]);
  const [preview, setPreview] = useState<RoutePlotPreview | null>(null);
  const [plotError, setPlotError] = useState<string | null>(null);
  const [plot, { isLoading: plotting }] = usePlotRouteMutation();

  // The roads, asked for after the pins settle. A request from an earlier
  // arrangement of pins that lands late is dropped — the map should only ever
  // show the path for the pins that are on it.
  const requestSeq = useRef(0);
  useEffect(() => {
    if (waypoints.length < 2) {
      setPreview(null);
      setPlotError(null);
      return;
    }
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      try {
        const result = await plot({ waypoints }).unwrap();
        if (seq !== requestSeq.current) return;
        setPreview(result);
        setPlotError(null);
      } catch (e: any) {
        if (seq !== requestSeq.current) return;
        setPreview(null);
        setPlotError(e?.data?.error ?? "Couldn't draw the roads between those pins.");
      }
    }, PLOT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [waypoints, plot]);

  const path = useMemo(() => (preview ? decodePolyline(preview.polyline) : []), [preview]);

  /**
   * A tap on the map.
   *
   * The first two are the ends. Every one after is a road to pull the path
   * through, and it goes into the leg it's nearest — the pair of neighbouring
   * pins whose straight line it lengthens least — rather than onto the end
   * of the list, so you can fix the second half of a drive after the first
   * without the path doubling back.
   */
  // Each arrangement of pins before a change, so Undo puts back exactly what
  // the last tap did — a via pulled into the middle comes out of the middle,
  // not the finish off the end.
  const history = useRef<LatLng[][]>([]);

  const addPoint = useCallback((point: LatLng) => {
    setWaypoints((prev) => {
      history.current.push(prev);
      if (prev.length < 2) return [...prev, point];
      if (prev.length >= MAX_VIAS + 2) {
        history.current.pop();
        Alert.alert('That\'s enough pins', `A route can be pulled through up to ${MAX_VIAS} roads.`);
        return prev;
      }
      let bestIndex = 1;
      let bestDetour = Infinity;
      for (let i = 0; i < prev.length - 1; i++) {
        const a = prev[i];
        const b = prev[i + 1];
        const detour = haversine(a, point) + haversine(point, b) - haversine(a, b);
        if (detour < bestDetour) {
          bestDetour = detour;
          bestIndex = i + 1;
        }
      }
      const next = prev.slice();
      next.splice(bestIndex, 0, point);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  /** A tap on a pin takes it off — any pin, including an end. */
  const removePoint = useCallback((id: string) => {
    if (!id.startsWith('wp-')) return;
    const index = Number(id.slice(3));
    if (!Number.isInteger(index)) return;
    setWaypoints((prev) => {
      history.current.push(prev);
      return prev.filter((_, i) => i !== index);
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const undo = () => {
    const previous = history.current.pop();
    setWaypoints(previous ?? []);
  };

  const markers = useMemo(() => waypoints.map((w, i) => {
    const last = waypoints.length - 1;
    const kind = i === 0 ? 'start' : i === last && last >= 1 ? 'finish' : 'via';
    return {
      id: `wp-${i}`,
      lat: w.lat,
      lng: w.lng,
      label: kind === 'start' ? 'Start' : kind === 'finish' ? 'Finish' : `Via ${i}`,
      systemImage: kind === 'start' ? 'location.fill' : kind === 'finish' ? 'flag.checkered' : 'circle.fill',
      tintColor: kind === 'start' ? START_COLOR : kind === 'finish' ? FINISH_COLOR : brand,
    };
  }), [waypoints, brand]);

  const next = () => {
    if (!preview || waypoints.length < 2) return;
    if (preview.too_short) {
      Alert.alert('Too short', 'That drive is too short to save as a route — move the finish further along.');
      return;
    }
    navigation.navigate('RouteSave', {
      plot: {
        waypoints,
        polyline: preview.polyline,
        distance_meters: preview.stats.distance_meters,
        curviness: preview.stats.curviness,
      },
    });
  };

  const close = () => {
    if (waypoints.length === 0) {
      navigation.goBack();
      return;
    }
    Alert.alert('Leave without saving?', 'The pins you placed will be lost.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  // What to do next, in one line. The screen's only instruction.
  const hint = waypoints.length === 0
    ? 'Tap the map where the drive started'
    : waypoints.length === 1
      ? 'Now tap where it finished'
      : 'Not the road you took? Tap the road to pull the route through it';

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {center && (
        <RouteMap
          path={path}
          center={center.point}
          zoom={center.zoom}
          color={brand}
          markers={markers}
          showEndpoints={false}
          showsUserLocation={locationGranted}
          onMapClick={addPoint}
          onMarkerClick={removePoint}
          style={StyleSheet.absoluteFill}
        />
      )}

      <TouchableOpacity
        style={[styles.close, { top: insets.top + 12 }]}
        onPress={close}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <X size={22} color="#FFFFFF" />
      </TouchableOpacity>

      {waypoints.length > 0 && (
        <TouchableOpacity
          style={[styles.undo, { top: insets.top + 12 }]}
          onPress={undo}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Remove the last pin"
        >
          <Undo2 size={18} color="#FFFFFF" />
          <Text style={styles.undoText}>Undo</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.panel, { backgroundColor: colors.card, paddingBottom: insets.bottom + 18 }]}>
        <Text style={[styles.title, { color: colors.fg }]}>Plot a past drive</Text>
        <Text style={[styles.hint, { color: colors.grey }]}>{hint}</Text>

        {/* The pins, as a legend that doubles as a count. */}
        <View style={styles.legend}>
          <Legend Icon={MapPin} color={START_COLOR} label="Start" on={waypoints.length >= 1} colors={colors} />
          <Legend Icon={Flag} color={FINISH_COLOR} label="Finish" on={waypoints.length >= 2} colors={colors} />
          {waypoints.length > 2 && (
            <Text style={[styles.viaCount, { color: colors.grey }]}>
              · through {waypoints.length - 2} road{waypoints.length === 3 ? '' : 's'}
            </Text>
          )}
        </View>

        <View style={styles.readout}>
          {plotting ? (
            <View style={styles.readoutRow}>
              <ActivityIndicator size="small" color={brand} />
              <Text style={[styles.readoutText, { color: colors.grey }]}>Finding the roads…</Text>
            </View>
          ) : plotError ? (
            <Text style={[styles.readoutText, { color: '#E23B3B' }]}>{plotError}</Text>
          ) : preview ? (
            <View style={styles.readoutRow}>
              <Text style={[styles.distance, { color: colors.fg }]}>{formatDistance(preview.stats.distance_meters)}</Text>
              <Text style={[styles.readoutText, { color: colors.grey }]}>
                · {curvinessLabel(preview.stats.curviness)}
              </Text>
            </View>
          ) : (
            <Text style={[styles.readoutText, { color: colors.grey }]}>Tap a pin to remove it.</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: brand }, (!preview || plotting) && styles.nextOff]}
          onPress={next}
          disabled={!preview || plotting}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Continue to save this route"
        >
          <Text style={[styles.nextLabel, { color: onBrand }]}>Next</Text>
          <ArrowRight size={18} color={onBrand} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Legend({ Icon, color, label, on, colors }: {
  Icon: typeof MapPin; color: string; label: string; on: boolean; colors: any;
}) {
  return (
    <View style={[styles.legendItem, !on && styles.legendOff]}>
      <Icon size={13} color={color} />
      <Text style={[styles.legendText, { color: colors.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  close: {
    position: 'absolute', left: 16,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  undo: {
    position: 'absolute', right: 16,
    height: 38, paddingHorizontal: 14, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    zIndex: 10,
  },
  undoText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 18,
    gap: 6,
  },
  title: { fontSize: 18, fontWeight: '800' },
  hint:  { fontSize: 13.5, lineHeight: 18 },

  legend:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendOff:  { opacity: 0.35 },
  legendText: { fontSize: 12.5, fontWeight: '700' },
  viaCount:   { fontSize: 12.5 },

  readout:     { minHeight: 28, justifyContent: 'center', marginTop: 4 },
  readoutRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  readoutText: { fontSize: 13.5 },
  distance:    { fontSize: 20, fontWeight: '800' },

  nextBtn: {
    marginTop: 10, height: 50, borderRadius: COMMON_RADIUS,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  nextOff:   { opacity: 0.45 },
  nextLabel: { fontSize: 16, fontWeight: '800' },
});
