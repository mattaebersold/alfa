import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '@ors/kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { X, Images, SwitchCamera } from 'lucide-react-native';
import { COLOR_WHITE, COLOR_BLACK, COLOR_RED, PILL_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/** What the camera hands back — the shape the create form's drafts take. */
export type CameraCapture =
  | { kind: 'image'; uri: string; width?: number; height?: number }
  | { kind: 'video'; uri: string };

/** Longest a clip can run, in seconds — the post's own limit. */
const MAX_VIDEO_S = 120;

/**
 * The app's own camera, over the form: take a photo, record a clip, or step
 * out to the library — all from one place. The system camera could do the
 * first two but has no way into the roll, and a sheet asking which first
 * was one tap too many before the thing you came to do.
 *
 * Photo by default; the switch under the shutter changes to video, where the
 * shutter starts and stops. Flip on the right, the library on the left.
 */
export default function CameraSheet({ visible, onClose, onCapture, onPickLibrary }: {
  visible: boolean;
  onClose: () => void;
  /** A photo or a clip, taken; the sheet stays up for another. */
  onCapture: (capture: CameraCapture) => void;
  /** "Choose from library" — the host closes this and opens its picker. */
  onPickLibrary: () => void;
}) {
  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [micPermission, requestMic] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [mode, setMode] = useState<'picture' | 'video'>('picture');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // Asked on open rather than on the first shutter press, so the preview is
  // up when the sheet is.
  useEffect(() => {
    if (!visible) return;
    if (!cameraPermission?.granted) void requestCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Back to the start each time it opens.
  useEffect(() => {
    if (visible) { setMode('picture'); setRecording(false); setSeconds(0); setBusy(false); setReady(false); }
  }, [visible]);

  // The clock on a recording.
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || !ready || busy) return;
    setBusy(true);
    try {
      const shot = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (shot?.uri) onCapture({ kind: 'image', uri: shot.uri, width: shot.width, height: shot.height });
    } finally {
      setBusy(false);
    }
  }, [ready, busy, onCapture]);

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || !ready || busy || recording) return;
    if (!micPermission?.granted) {
      const r = await requestMic();
      if (!r.granted) return;
    }
    setRecording(true);
    setSeconds(0);
    try {
      const clip = await cameraRef.current.recordAsync({ maxDuration: MAX_VIDEO_S });
      if (clip?.uri) onCapture({ kind: 'video', uri: clip.uri });
    } finally {
      setRecording(false);
    }
  }, [ready, busy, recording, micPermission, requestMic, onCapture]);

  const stopRecording = useCallback(() => { cameraRef.current?.stopRecording(); }, []);

  const shutter = () => {
    if (mode === 'picture') void takePhoto();
    else if (recording) stopRecording();
    else void startRecording();
  };

  const denied = cameraPermission && !cameraPermission.granted && !cameraPermission.canAskAgain;
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.fill}>
        {cameraPermission?.granted ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mode={mode}
            onCameraReady={() => setReady(true)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            {denied ? (
              <>
                <Text style={styles.note}>Camera access is off for Open Road Society.</Text>
                <Text style={styles.noteSub}>Turn it on in Settings, or choose from your library.</Text>
              </>
            ) : <ActivityIndicator color={COLOR_WHITE} />}
          </View>
        )}

        {/* Top: close, and the clock while recording. */}
        <SafeAreaView style={styles.top} edges={['top']} pointerEvents="box-none">
          <TouchableOpacity onPress={onClose} style={styles.circleBtn} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close camera">
            <X size={22} color={COLOR_WHITE} strokeWidth={2.4} />
          </TouchableOpacity>
          {recording && (
            <View style={styles.clock}>
              <View style={styles.clockDot} />
              <Text style={styles.clockText}>{clock}</Text>
            </View>
          )}
          <View style={styles.circleBtnGhost} />
        </SafeAreaView>

        {/* Bottom: library, shutter, flip; the photo / video switch under. */}
        <SafeAreaView style={styles.bottom} edges={['bottom']} pointerEvents="box-none">
          <View style={styles.controls}>
            <TouchableOpacity
              onPress={onPickLibrary}
              style={styles.circleBtn}
              hitSlop={12}
              disabled={recording}
              accessibilityRole="button"
              accessibilityLabel="Choose from library"
            >
              <Images size={22} color={COLOR_WHITE} strokeWidth={2.2} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={shutter}
              disabled={!cameraPermission?.granted || !ready || busy}
              style={[styles.shutter, mode === 'video' && styles.shutterVideo]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={mode === 'picture' ? 'Take photo' : recording ? 'Stop recording' : 'Record video'}
            >
              {busy
                ? <ActivityIndicator color={COLOR_BLACK} />
                : <View style={[styles.shutterInner, mode === 'video' && styles.shutterInnerVideo, recording && styles.shutterInnerStop]} />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
              style={styles.circleBtn}
              hitSlop={12}
              disabled={recording}
              accessibilityRole="button"
              accessibilityLabel="Flip camera"
            >
              <SwitchCamera size={22} color={COLOR_WHITE} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={styles.modes}>
            {(['picture', 'video'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => !recording && setMode(m)}
                hitSlop={8}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
              >
                <Text style={[styles.modeText, mode === m && styles.modeTextOn]}>{m === 'picture' ? 'Photo' : 'Video'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill:   { flex: 1, backgroundColor: COLOR_BLACK },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  note:    { color: COLOR_WHITE, fontSize: 15, fontFamily: FONT_INTER.bold, textAlign: 'center' },
  noteSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' },

  top: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8,
  },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 12 },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  circleBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  circleBtnGhost: { width: 44, height: 44 },
  // A white ring with a white disc; in video it's a red disc, and a red square while recording.
  shutter: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 4, borderColor: COLOR_WHITE,
    alignItems: 'center', justifyContent: 'center',
  },
  shutterVideo:       { borderColor: 'rgba(255,255,255,0.8)' },
  shutterInner:       { width: 60, height: 60, borderRadius: 30, backgroundColor: COLOR_WHITE },
  shutterInnerVideo:  { backgroundColor: COLOR_RED },
  shutterInnerStop:   { width: 28, height: 28, borderRadius: 6 },
  modes: { flexDirection: 'row', justifyContent: 'center', gap: 24, paddingTop: 14 },
  modeText:   { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: FONT_INTER.bold, letterSpacing: 0.3 },
  modeTextOn: { color: COLOR_WHITE },
  clock: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: PILL_RADIUS,
  },
  clockDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: COLOR_RED },
  clockText: { color: COLOR_WHITE, fontSize: 13, fontFamily: FONT_INTER.bold, fontVariant: ['tabular-nums'] },
});
