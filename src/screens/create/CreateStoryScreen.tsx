import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, Pressable, TouchableOpacity, StyleSheet,
  Alert, StatusBar, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useVideoPlayer, VideoView } from 'expo-video';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import * as ScreenOrientation from 'expo-screen-orientation';
import Svg, { Circle } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const MAX_DURATION = 30; // seconds
const RING_SIZE = 96;
const RING_RADIUS = 44;
const RING_STROKE = 3.5;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Progress ring ───────────────────────────────────────────────────────────

function ProgressRing({ progress }: { progress: number }) {
  const dashOffset = CIRCUMFERENCE * (1 - Math.min(progress, 1));
  return (
    <Svg
      width={RING_SIZE}
      height={RING_SIZE}
      style={StyleSheet.absoluteFillObject}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
    >
      {/* Track */}
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={RING_STROKE}
        fill="none"
      />
      {/* Fill — rotated so it starts at top */}
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        stroke="#ef4444"
        strokeWidth={RING_STROKE}
        fill="none"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        rotation="-90"
        origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
      />
    </Svg>
  );
}

// ─── Recorded preview ────────────────────────────────────────────────────────

function RecordedPreview({
  uri, onReRecord, onNext, processing,
}: {
  uri: string;
  onReRecord: () => void;
  onNext: () => void;
  processing: boolean;
}) {
  const [videoReady, setVideoReady] = useState(false);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });

  // Play only once video is ready
  const handleReadyForDisplay = useCallback(() => {
    setVideoReady(true);
    player.play();
  }, [player]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Portrait-constrained video */}
      <View style={styles.videoContainer}>
        {!videoReady && (
          <View style={styles.videoSpinner}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        )}
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
          onFirstFrameRender={handleReadyForDisplay}
        />
      </View>

      {/* Close */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <TouchableOpacity onPress={onReRecord} style={styles.closeBtn} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Footer buttons */}
      <SafeAreaView style={styles.previewFooter} edges={['bottom']}>
        <View style={styles.previewButtons}>
          <TouchableOpacity onPress={onReRecord} style={[styles.previewBtn, styles.previewBtnSecondary]}>
            <Text style={styles.previewBtnSecondaryText}>Re-record</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onNext}
            disabled={processing || !videoReady}
            style={[styles.previewBtn, styles.previewBtnPrimary, (processing || !videoReady) && styles.previewBtnDisabled]}
          >
            {processing
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={styles.previewBtnPrimaryText}>Next</Text>
            }
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function CreateStoryScreen() {
  const navigation = useNavigation<NavProp>();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cameraRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartRef = useRef<number>(0);

  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0); // seconds, float
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const hasPermissions = cameraPermission?.granted && micPermission?.granted;

  // Lock to portrait for recording; restore on leave
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Auto-stop when MAX_DURATION is reached
  useEffect(() => {
    if (recordingTime >= MAX_DURATION && isRecording) {
      stopRecording();
    }
  }, [recordingTime]); // eslint-disable-line react-hooks/exhaustive-deps

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || isRecording || recordedUri) return;
    setIsRecording(true);
    setRecordingTime(0);
    recordStartRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setRecordingTime(t => t + 0.1);
    }, 100);

    try {
      const result = await cameraRef.current.record({ maxDuration: MAX_DURATION });
      const elapsed = (Date.now() - recordStartRef.current) / 1000;
      if (elapsed >= 2) {
        setRecordedUri(result.uri);
      }
      // else: too short — discard and stay on camera view
    } catch {
      // released before recording started — ignore
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
      setRecordingTime(0);
    }
  }, [isRecording, recordedUri]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
    }
  }, [isRecording]);

  const handleReRecord = () => {
    setRecordedUri(null);
    setRecordingTime(0);
  };

  const handleNext = async () => {
    if (!recordedUri) return;
    setProcessing(true);
    try {
      const thumb = await getThumbnailAsync(recordedUri, { time: 100 });
      navigation.navigate('StoryDetails', {
        videoUri: recordedUri,
        thumbnailUri: thumb.uri,
      });
    } catch {
      Alert.alert('Error', 'Could not process video. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const requestPermissions = async () => {
    await requestCameraPermission();
    await requestMicPermission();
  };

  // ── Recorded preview ──
  if (recordedUri) {
    return (
      <RecordedPreview
        uri={recordedUri}
        onReRecord={handleReRecord}
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
        <Text style={styles.permTitle}>Camera & Microphone Access</Text>
        <Text style={styles.permSubtitle}>Required to record stories.</Text>
        <TouchableOpacity onPress={requestPermissions} style={styles.permBtn}>
          <Text style={styles.permBtnText}>Grant Access</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ringProgress = recordingTime / MAX_DURATION;
  const timeRemaining = Math.ceil(MAX_DURATION - recordingTime);

  // ── Camera view ──
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="video"
      />

      {/* Top bar */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {/* Recording time badge */}
        {isRecording && (
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingLabel}>{timeRemaining}s</Text>
          </View>
        )}

        {/* Flip camera */}
        <TouchableOpacity
          onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
          style={styles.flipBtn}
          hitSlop={12}
        >
          <Text style={styles.flipText}>⟳</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Record button + progress ring */}
      <SafeAreaView style={styles.footer} edges={['bottom']}>
        <View style={styles.ringWrapper}>
          {isRecording && <ProgressRing progress={ringProgress} />}
          <Pressable
            onPressIn={startRecording}
            onPressOut={stopRecording}
            style={[
              styles.recordBtn,
              isRecording && styles.recordBtnActive,
            ]}
          >
            <View style={isRecording ? styles.recordInnerSquare : styles.recordInnerCircle} />
          </Pressable>
        </View>
        <Text style={styles.hintText}>
          {isRecording ? 'Release to stop' : 'Hold to record'}
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // Permission gate
  permGate: {
    flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  permTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  permSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginBottom: 32 },
  permBtn: {
    backgroundColor: '#fff', borderRadius: 50, paddingHorizontal: 32, paddingVertical: 14, marginBottom: 12,
  },
  permBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  cancelBtn: { paddingVertical: 10 },
  cancelText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 18 },
  recordingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  recordingLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
  flipBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  flipText: { color: '#fff', fontSize: 22, lineHeight: 26 },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', gap: 12, zIndex: 10,
    paddingBottom: 24,
  },
  ringWrapper: {
    width: RING_SIZE, height: RING_SIZE,
    alignItems: 'center', justifyContent: 'center',
  },
  recordBtn: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  recordBtnActive: {
    borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.15)',
  },
  recordInnerCircle: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff',
  },
  recordInnerSquare: {
    width: 26, height: 26, borderRadius: 4, backgroundColor: '#ef4444',
  },
  hintText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },

  // Preview
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  videoSpinner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  previewFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  previewButtons: {
    flexDirection: 'row', gap: 12, padding: 16,
  },
  previewBtn: {
    flex: 1, borderRadius: 50, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    minHeight: 50,
  },
  previewBtnSecondary: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  previewBtnSecondaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  previewBtnPrimary: { backgroundColor: '#fff' },
  previewBtnPrimaryText: { color: '#000', fontWeight: '700', fontSize: 15 },
  previewBtnDisabled: { opacity: 0.4 },
});
