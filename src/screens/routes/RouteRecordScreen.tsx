import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Play, Pause, Square, X, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import RouteMap from '../../components/routes/RouteMap';
import { useRouteRecorder, readDraft, clearDraft } from '../../hooks/useRouteRecorder';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, useIsPro, contrastText } from '../../hooks/useBrandColor';
import { formatDistance, formatDuration, formatSpeed, haversine } from '../../utils/routeGeometry';
import { formatDistanceToNow } from 'date-fns';
import PitStopSheet from '../../components/routes/PitStopSheet';
import { colors as palette } from '../../constants/colors';
import type { AppStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

/**
 * The recording screen: a live map with the drive traced onto it, the running
 * numbers, and start/pause/stop.
 *
 * All the location handling lives in useRouteRecorder — this screen only
 * renders its state and decides where to go when the drive ends.
 */
export default function RouteRecordScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const brand = useBrandColor();
  const onBrand = contrastText(brand);
  const isPro = useIsPro();

  const recorder = useRouteRecorder();
  const { status, stats, path, error, isRecording, isPaused } = recorder;
  const [busy, setBusy] = useState(false);

  // The API rejects non-pro creates anyway; this is so someone who reaches the
  // screen by another path gets an explanation rather than a failed save.
  useEffect(() => {
    if (!isPro) {
      Alert.alert(
        'Pro membership required',
        'Recording routes is a pro member feature.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    }
  }, [isPro, navigation]);

  // An interrupted drive is on disk but invisible until it's offered back —
  // without this prompt, closing the app mid-route silently loses it.
  const recoveryChecked = useRef(false);
  useEffect(() => {
    if (!isPro || recoveryChecked.current) return;
    recoveryChecked.current = true;

    const draft = readDraft();
    if (!draft?.samples?.length) return;

    const when = formatDistanceToNow(new Date(draft.endedAt), { addSuffix: true });
    const miles = formatDistance(
      draft.samples.reduce((sum, s, i) =>
        i === 0 ? 0 : sum + (s.t - draft.samples[i - 1].t > 10000 ? 0 : haversine(draft.samples[i - 1], s)), 0),
    );

    Alert.alert(
      'Unfinished route',
      `You have a drive from ${when} — about ${miles} recorded. Pick it back up, or finish it now?`,
      [
        { text: 'Discard', style: 'destructive', onPress: () => clearDraft() },
        { text: 'Finish it', onPress: () => navigation.replace('RouteSave', { draftId: draft.draftId }) },
        { text: 'Keep driving', onPress: () => recorder.resumeFromDraft() },
      ],
    );
  }, [isPro]); // eslint-disable-line react-hooks/exhaustive-deps

  // The position is frozen when the button is tapped, so typing a name at the
  // roadside doesn't drag the pin along with the car.
  const [pitStopAt, setPitStopAt] = useState<{ lat: number; lng: number } | null>(null);

  const handlePitStop = () => {
    const last = path[path.length - 1];
    if (!last) {
      Alert.alert('Not yet', 'Waiting for a GPS fix — try again in a moment.');
      return;
    }
    setPitStopAt({ lat: last.lat, lng: last.lng });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handleStart = async () => {
    setBusy(true);
    const ok = await recorder.start();
    setBusy(false);
    if (ok) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const handleStop = () => {
    Alert.alert('Finish drive?', 'Stop recording this route.', [
      { text: 'Keep driving', style: 'cancel' },
      {
        text: 'Finish',
        style: 'destructive',
        onPress: async () => {
          const draft = await recorder.stop();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          if (!draft) {
            Alert.alert(
              'Nothing recorded',
              "We didn't get enough GPS points to save a route.",
              [{ text: 'OK', onPress: () => navigation.goBack() }],
            );
            return;
          }
          navigation.replace('RouteSave', { draftId: draft.draftId });
        },
      },
    ]);
  };

  const handleClose = () => {
    if (status === 'idle') {
      navigation.goBack();
      return;
    }
    Alert.alert('Discard this drive?', 'The recording will be lost.', [
      { text: 'Keep recording', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          recorder.discard();
          navigation.goBack();
        },
      },
    ]);
  };

  const lastPoint = path[path.length - 1];

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <RouteMap
        path={path}
        speeds={path.map((p) => p.speed)}
        center={lastPoint}
        color={brand}
        showsUserLocation
        followsUser={isRecording}
        style={StyleSheet.absoluteFill}
      />

      {/* Close — sits above the map */}
      <TouchableOpacity
        style={[styles.close, { top: insets.top + 12 }]}
        onPress={handleClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <X size={22} color="#FFFFFF" />
      </TouchableOpacity>

      {error && (
        <View style={[styles.errorBar, { top: insets.top + 12 }]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Stats + controls */}
      <View style={[styles.panel, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.statsRow}>
          <Stat label="Distance" value={formatDistance(stats.distanceMeters)} colors={colors} />
          <Stat label="Time" value={formatDuration(stats.elapsedMs)} colors={colors} />
          <Stat label="Speed" value={formatSpeed(stats.currentSpeed)} colors={colors} />
        </View>

        <View style={styles.controls}>
          {status === 'idle' || status === 'starting' ? (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: brand }]}
              onPress={handleStart}
              disabled={busy || status === 'starting'}
              accessibilityRole="button"
              accessibilityLabel="Start recording"
            >
              {busy || status === 'starting' ? (
                <ActivityIndicator color={onBrand} />
              ) : (
                <>
                  <Play size={22} color={onBrand} fill={onBrand} />
                  <Text style={[styles.primaryLabel, { color: onBrand }]}>Start Drive</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <>
              {/* Pause is the button people reach for most while stopped, so it
                  gets the brand fill and the width, not the destructive one. */}
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: isPaused ? brand : colors.card, borderWidth: isPaused ? 0 : 1.5, borderColor: colors.border }]}
                onPress={isPaused ? recorder.resume : recorder.pause}
                accessibilityRole="button"
                accessibilityLabel={isPaused ? 'Resume recording' : 'Pause recording'}
              >
                {isPaused
                  ? <Play size={20} color={onBrand} fill={onBrand} />
                  : <Pause size={20} color={colors.fg} fill={colors.fg} />}
                <Text style={[styles.primaryLabel, { color: isPaused ? onBrand : colors.fg }]}>
                  {isPaused ? 'Resume' : 'Pause'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.iconBtn, { borderColor: colors.border }]}
                onPress={handlePitStop}
                accessibilityRole="button"
                accessibilityLabel="Add pit stop"
              >
                <MapPin size={20} color={colors.fg} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.iconBtn, styles.stopBtn]}
                onPress={handleStop}
                accessibilityRole="button"
                accessibilityLabel="Finish recording"
              >
                <Square size={17} color="#FFFFFF" fill="#FFFFFF" />
              </TouchableOpacity>
            </>
          )}
        </View>

        {isPaused && (
          <Text style={[styles.paused, { color: brand }]}>
            Paused — time and distance are not counting.
          </Text>
        )}

        {recorder.pitStops.length > 0 && (
          <Text style={[styles.hint, { color: colors.grey }]}>
            {recorder.pitStops.length} pit stop{recorder.pitStops.length === 1 ? '' : 's'} added
          </Text>
        )}

        {isRecording && (
          <Text style={[styles.hint, { color: colors.grey }]}>
            {recorder.backgroundActive
              ? 'Recording continues if you close the app.'
              : 'Keep the app open and the screen on — background access was declined.'}
          </Text>
        )}
      </View>

      <PitStopSheet
        visible={!!pitStopAt}
        at={pitStopAt}
        onClose={() => setPitStopAt(null)}
        onSubmit={(label, note) => recorder.addPitStop(label, note)}
      />
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
  root: { flex: 1 },

  close: {
    position: 'absolute', left: 16,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },

  errorBar: {
    position: 'absolute', left: 66, right: 16,
    backgroundColor: palette.red,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10,
    zIndex: 10,
  },
  errorText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 18, paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 12,
  },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontWeight: '600', marginTop: 2, letterSpacing: 0.3 },

  controls: { flexDirection: 'row', gap: 12 },

  primaryBtn: {
    flex: 1, flexDirection: 'row', gap: 9,
    alignItems: 'center', justifyContent: 'center',
    height: 54, borderRadius: 14,
  },
  primaryLabel: { fontSize: 16, fontWeight: '800' },
  stopBtn: { backgroundColor: palette.red },

  iconBtn: {
    width: 54, height: 54, borderRadius: 14, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  paused: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 12 },

  hint: { fontSize: 12, textAlign: 'center', marginTop: 12 },
});
