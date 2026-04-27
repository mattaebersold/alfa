import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, Pressable, TouchableOpacity, StyleSheet, Alert, StatusBar, SafeAreaView,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useVideoPlayer, VideoView } from 'expo-video';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

// Minimal video preview using expo-video for the recorded clip
function RecordedPreview({ uri, onReRecord, onNext }: {
  uri: string;
  onReRecord: () => void;
  onNext: () => void;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
      />
      <SafeAreaView style={styles.previewFooter}>
        <View style={styles.previewButtons}>
          <TouchableOpacity onPress={onReRecord} style={[styles.previewBtn, styles.previewBtnSecondary]}>
            <Text style={styles.previewBtnSecondaryText}>Re-record</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onNext} style={[styles.previewBtn, styles.previewBtnPrimary]}>
            <Text style={styles.previewBtnPrimaryText}>Next</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

export default function CreateStoryScreen() {
  const navigation = useNavigation<NavProp>();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cameraRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const hasPermissions =
    cameraPermission?.granted && micPermission?.granted;

  const requestPermissions = async () => {
    await requestCameraPermission();
    await requestMicPermission();
  };

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || isRecording) return;
    setIsRecording(true);
    try {
      const result = await cameraRef.current.record({ maxDuration: 60 });
      setRecordedUri(result.uri);
    } catch (e) {
      // User may have released before recording started — ignore
    } finally {
      setIsRecording(false);
    }
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    if (!cameraRef.current || !isRecording) return;
    cameraRef.current.stopRecording();
  }, [isRecording]);

  const handleReRecord = () => {
    setRecordedUri(null);
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
    } catch (e) {
      Alert.alert('Error', 'Could not process video. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Show recorded preview
  if (recordedUri) {
    return (
      <RecordedPreview
        uri={recordedUri}
        onReRecord={handleReRecord}
        onNext={handleNext}
      />
    );
  }

  // Permissions gate
  if (!hasPermissions) {
    return (
      <View style={styles.permGate}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.permTitle}>Camera & Microphone Access</Text>
        <Text style={styles.permSubtitle}>
          Required to record stories.
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="video"
      />

      {/* Recording indicator */}
      {isRecording && (
        <View style={styles.recordingBadge}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingLabel}>Recording</Text>
        </View>
      )}

      {/* Close button */}
      <SafeAreaView style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Hold-to-record button */}
      <View style={styles.footer}>
        <Pressable
          onPressIn={startRecording}
          onPressOut={stopRecording}
          style={({ pressed }) => [
            styles.recordBtn,
            isRecording && styles.recordBtnActive,
            pressed && !isRecording && styles.recordBtnPressed,
          ]}
        >
          <View style={isRecording ? styles.recordInnerSquare : styles.recordInnerCircle} />
        </Pressable>
        <Text style={styles.hintText}>
          {isRecording ? 'Release to stop' : 'Hold to record'}
        </Text>
      </View>
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

  // Recording indicator
  recordingBadge: {
    position: 'absolute', top: 100, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
  },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' },
  recordingLabel: { color: '#fff', fontSize: 13, fontWeight: '500' },

  // Top bar
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  closeBtn: {
    margin: 16, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 18, fontWeight: '300' },

  // Footer
  footer: {
    position: 'absolute', bottom: 60, left: 0, right: 0,
    alignItems: 'center', gap: 12,
  },
  recordBtn: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  recordBtnActive: {
    borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.15)',
  },
  recordBtnPressed: {
    transform: [{ scale: 1.08 }],
  },
  recordInnerCircle: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff',
  },
  recordInnerSquare: {
    width: 28, height: 28, borderRadius: 4, backgroundColor: '#ef4444',
  },
  hintText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },

  // Preview
  previewFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  previewButtons: {
    flexDirection: 'row', gap: 12, padding: 16,
  },
  previewBtn: {
    flex: 1, borderRadius: 50, paddingVertical: 14, alignItems: 'center',
  },
  previewBtnSecondary: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  previewBtnSecondaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  previewBtnPrimary: { backgroundColor: '#fff' },
  previewBtnPrimaryText: { color: '#000', fontWeight: '700', fontSize: 15 },
});
