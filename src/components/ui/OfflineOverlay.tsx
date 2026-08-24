import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, AppState } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { connectionLost, connectionRestored, offlineNoticeDismissed } from '../../store/connectivitySlice';
import { probeInternet } from '../../utils/connectivity';
import { colors } from '../../constants/colors';

/** How often to check back while the device has no network. */
const RETRY_INTERVAL_MS = 8000;

/**
 * How long after the app comes forward that failed requests are ignored.
 *
 * Suspending an app tears down its in-flight sockets; they surface as failures
 * the instant it resumes, on a phone whose connection is fine. This was the
 * main way the old overlay appeared when it shouldn't have — switch away, come
 * back, get told you're offline.
 */
const RESUME_GRACE_MS = 3000;

/**
 * The "no connection" screen.
 *
 * It answers one situation only: the device has no network at all — aeroplane
 * mode, a dead zone, satellite/SOS. It is not a server-outage screen. Reaching
 * ORS is checked by the app's ordinary traffic; those failures only prompt a
 * check here, and a check that finds any public host reachable leaves the
 * overlay off, because the member's phone is working and a full-screen takeover
 * would be blaming their signal for our problem.
 *
 * "Continue offline" is there because parts of the app genuinely work without a
 * connection — recording a drive, most of all, which is exactly the thing
 * someone does where there is no signal.
 */
export default function OfflineOverlay() {
  const dispatch = useAppDispatch();
  const { online, dismissed, failureTick } = useAppSelector((s) => s.connectivity);
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const resumedAt = useRef(0);

  const check = useCallback(async () => {
    // Overlapping probes would fight over the same answer; a slow one on a bad
    // connection can easily outlive the retry interval.
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    const reachable = await probeInternet();
    checkingRef.current = false;
    setChecking(false);
    dispatch(reachable ? connectionRestored() : connectionLost());
  }, [dispatch]);

  // A failed request is a reason to go and look, not a reason to show the
  // screen. Failures in the moments after a resume are ignored outright: those
  // are the app's own severed sockets, not the network.
  useEffect(() => {
    if (failureTick === 0) return;
    if (Date.now() - resumedAt.current < RESUME_GRACE_MS) return;
    check();
  }, [failureTick, check]);

  // Keep checking while down, so the ordinary recovery is that the overlay
  // clears itself while the phone is in a pocket coming out of a tunnel.
  useEffect(() => {
    if (online) return;
    const id = setInterval(check, RETRY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [online, check]);

  // Coming back from the background: re-check only if we're currently claiming
  // to be offline, and never flip straight to the screen on the strength of
  // whatever failed while the app was suspended.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      resumedAt.current = Date.now();
      if (!online) check();
    });
    return () => sub.remove();
  }, [online, check]);

  if (online || dismissed) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <View style={styles.iconRing}>
          <WifiOff size={26} color={colors.pro} strokeWidth={2} />
        </View>

        <Text style={styles.title}>No connection</Text>
        <Text style={styles.body}>
          Your device isn't connected to a network right now. Check your signal,
          wifi or aeroplane mode — this screen will clear itself the moment
          you're back.
        </Text>

        <TouchableOpacity
          style={styles.retryBtn}
          onPress={check}
          disabled={checking}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ disabled: checking, busy: checking }}
        >
          {/* The label holds its place under the spinner so the button keeps
              its size while a check is in flight. */}
          <Text style={[styles.retryText, checking && styles.labelHidden]}>Try again</Text>
          {checking && <ActivityIndicator size="small" color="#000000" style={StyleSheet.absoluteFill} />}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => dispatch(offlineNoticeDismissed())}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
        >
          <Text style={styles.dismiss}>Continue offline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: 'rgba(10,10,10,0.94)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28,
    zIndex: 999,
  },
  panel: { alignItems: 'center', maxWidth: 340 },
  iconRing: {
    width: 62, height: 62, borderRadius: 31,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(205,169,111,0.14)',
    borderWidth: 1, borderColor: 'rgba(205,169,111,0.35)',
    marginBottom: 18,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  body: {
    fontSize: 14, lineHeight: 20, color: colors.greyLight,
    textAlign: 'center', marginBottom: 22,
  },
  retryBtn: {
    backgroundColor: colors.pro, borderRadius: 999,
    paddingHorizontal: 28, paddingVertical: 12,
    justifyContent: 'center', marginBottom: 14,
  },
  retryText: { fontSize: 15, fontWeight: '800', color: '#000000' },
  labelHidden: { opacity: 0 },
  dismiss: { fontSize: 13, fontWeight: '600', color: colors.grey },
});
