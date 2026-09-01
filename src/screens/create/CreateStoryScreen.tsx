import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, StatusBar, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useVideoPlayer, VideoView } from 'expo-video';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const MAX_DURATION = 30;
const { width: SW, height: SH } = Dimensions.get('window');

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ elapsed }: { elapsed: number }) {
  const pct = Math.min(elapsed / MAX_DURATION, 1);
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${pct * 100}%` }]} />
    </View>
  );
}
const pb = StyleSheet.create({
  track: {
    height: 3, backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2, overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: '#ef4444', borderRadius: 2 },
});

// ─── Recorded preview ─────────────────────────────────────────────────────────

function RecordedPreview({
  uri, onDiscard, onNext, processing,
}: {
  uri: string;
  onDiscard: () => void;
  onNext: () => void;
  processing: boolean;
}) {
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer(uri, (p) => { p.loop = true; });

  const handleReady = useCallback(() => {
    setReady(true);
    player.play();
  }, [player]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" hidden />

      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        onFirstFrameRender={handleReady}
      />

      {!ready && (
        <View style={styles.overlay}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      )}

      {/* Top-left: discard */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <TouchableOpacity onPress={onDiscard} style={styles.circleBtn} hitSlop={12}>
          <Text style={styles.circleBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.previewLabel}>
          <Text style={styles.previewLabelText}>Preview</Text>
        </View>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      {/* Bottom: action buttons */}
      <SafeAreaView style={styles.previewFooter} edges={['bottom']}>
        <TouchableOpacity onPress={onDiscard} style={styles.discardBtn}>
          <Text style={styles.discardBtnText}>Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onNext}
          disabled={processing || !ready}
          style={[styles.nextBtn, (processing || !ready) && { opacity: 0.5 }]}
        >
          {processing
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={styles.nextBtnText}>Use Video →</Text>
          }
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CreateStoryScreen() {
  const navigation = useNavigation<NavProp>();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const cameraRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [cameraReady, setCameraReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const hasPermissions = cameraPermission?.granted && micPermission?.granted;

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Auto-stop at max duration
  useEffect(() => {
    if (elapsed >= MAX_DURATION && isRecording) stopRecording();
  }, [elapsed]); // eslint-disable-line react-hooks/exhaustive-deps

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || isRecording || recordedUri) return;
    setIsRecording(true);
    setElapsed(0);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setElapsed((Date.now() - startTimeRef.current) / 1000);
    }, 100);

    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: MAX_DURATION });
      const duration = (Date.now() - startTimeRef.current) / 1000;
      if (duration < 1.5) {
        Alert.alert('Too short', 'Hold the record button for at least 2 seconds.');
      } else {
        setRecordedUri(result.uri);
      }
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (!msg.includes('Recording was stopped') && !msg.includes('aborted')) {
        console.error('[Story] record error:', err);
        Alert.alert('Recording failed', 'Could not start recording. Please try again.');
      }
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setIsRecording(false);
      setElapsed(0);
    }
  }, [isRecording, recordedUri, cameraReady]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    cameraRef.current?.stopRecording();
  }, []);

  const handleDiscard = () => {
    setRecordedUri(null);
    setElapsed(0);
  };

  const handleNext = async () => {
    if (!recordedUri) return;
    setProcessing(true);
    try {
      const thumb = await getThumbnailAsync(recordedUri, { time: 100 });
      navigation.navigate('StoryDetails', { videoUri: recordedUri, thumbnailUri: thumb.uri });
    } catch {
      Alert.alert('Error', 'Could not process video. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const requestPermissions = async () => {
    if (!cameraPermission?.granted) await requestCameraPermission();
    if (!micPermission?.granted) await requestMicPermission();
  };

  // ── Preview ──
  if (recordedUri) {
    return (
      <RecordedPreview
        uri={recordedUri}
        onDiscard={handleDiscard}
        onNext={handleNext}
        processing={processing}
      />
    );
  }

  // ── Permissions gate ──
  if (!hasPermissions) {
    return (
      <View style={styles.permGate}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.permTitle}>Camera & Microphone</Text>
        <Text style={styles.permSub}>
          Open Road Society needs camera and microphone access to record video stories.
        </Text>
        <TouchableOpacity onPress={requestPermissions} style={styles.permBtn}>
          <Text style={styles.permBtnText}>Grant Access</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const timeLeft = Math.max(0, Math.ceil(MAX_DURATION - elapsed));

  // ── Camera ──
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" hidden />

      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="video"
        zoom={0}
        onCameraReady={() => setCameraReady(true)}
      />

      {/* Top bar */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.circleBtn}
          hitSlop={12}
        >
          <Text style={styles.circleBtnText}>✕</Text>
        </TouchableOpacity>

        {/* Progress bar + timer — only visible while recording */}
        {isRecording && (
          <View style={styles.recordingInfo}>
            <View style={styles.progressBarWrapper}>
              <ProgressBar elapsed={elapsed} />
            </View>
            <View style={styles.timerBadge}>
              <View style={styles.recDot} />
              <Text style={styles.timerText}>{timeLeft}s</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          onPress={() => { setCameraReady(false); setFacing(f => f === 'back' ? 'front' : 'back'); }}
          style={styles.circleBtn}
          hitSlop={12}
        >
          <Text style={styles.circleBtnText}>⟳</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Bottom: record button */}
      <SafeAreaView style={styles.footer} edges={['bottom']}>
        <Text style={styles.hint}>
          {isRecording ? 'Tap to stop' : 'Tap to record'}
        </Text>
        <TouchableOpacity
          onPress={isRecording ? stopRecording : startRecording}
          style={[styles.recordBtnOuter, !cameraReady && styles.recordBtnDisabled]}
          activeOpacity={0.85}
          disabled={!cameraReady && !isRecording}
        >
          <View style={[
            styles.recordBtnInner,
            isRecording && styles.recordBtnInnerActive,
          ]} />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center',
  },

  // Permission gate
  permGate: {
    flex: 1, backgroundColor: '#0a0a0a',
    alignItems: 'center', justifyContent: 'center', padding: 36,
  },
  permTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  permSub: {
    color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center',
    lineHeight: 21, marginBottom: 36,
  },
  permBtn: {
    backgroundColor: '#fff', borderRadius: 50,
    paddingHorizontal: 36, paddingVertical: 15, marginBottom: 14,
  },
  permBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  cancelBtn: { paddingVertical: 10 },
  cancelText: { color: 'rgba(255,255,255,0.45)', fontSize: 14 },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, gap: 8,
  },
  circleBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  circleBtnText: { color: '#fff', fontSize: 18 },
  recordingInfo: {
    flex: 1, gap: 6,
  },
  progressBarWrapper: { paddingHorizontal: 4 },
  timerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'center',
  },
  recDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#ef4444' },
  timerText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
    alignItems: 'center', paddingBottom: 32, gap: 14,
  },
  hint: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '500' },
  recordBtnOuter: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  recordBtnInner: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff',
  },
  recordBtnInnerActive: {
    width: 28, height: 28, borderRadius: 6, backgroundColor: '#ef4444',
  },
  recordBtnDisabled: { opacity: 0.4 },

  // Preview
  previewLabel: { flex: 1, alignItems: 'center' },
  previewLabelText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  previewFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', gap: 12, padding: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  discardBtn: {
    flex: 1, borderRadius: 50, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  discardBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  nextBtn: {
    flex: 2, borderRadius: 50, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
  },
  nextBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
});
