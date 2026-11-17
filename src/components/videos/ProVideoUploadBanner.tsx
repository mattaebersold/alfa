import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { RotateCcw, X, CloudUpload, AlertCircle, WifiOff } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import ActionSheet from '../ui/ActionSheet';
import { colors } from '../../constants/colors';
import { COMMON_RADIUS, COLOR_RED, COLOR_WHITE, SURFACE_MID } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import {
  useProVideoUploads, describeProgress, retryProVideoUpload, cancelProVideoUpload,
  type ProVideoUpload,
} from '../../utils/proVideoUpload';

/**
 * The videos on their way up, at the top of the Videos pane: one bar each,
 * with what it's doing — preparing, how much of how much and how long left,
 * waiting out a dropped connection — and a ✕ to stop it. A failed one turns
 * red and offers Retry, which carries on from where Mux says it got to.
 *
 * The uploads themselves live in utils/proVideoUpload, outside any screen;
 * this only draws them.
 */
export default function ProVideoUploadBanner() {
  const uploads = useProVideoUploads();
  const [confirm, setConfirm] = useState<ProVideoUpload | null>(null);
  if (uploads.length === 0) return null;
  return (
    <View style={styles.wrap}>
      {uploads.map((u) => (
        <Bar key={u.key} upload={u} onStop={() => setConfirm(u)} />
      ))}
      <ActionSheet
        visible={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.phase === 'failed' ? 'Remove this upload?' : 'Stop uploading?'}
        message={confirm?.phase === 'failed'
          ? 'Its file on this phone is deleted too.'
          : 'What has gone up so far is thrown away.'}
        options={[
          {
            label: confirm?.phase === 'failed' ? 'Remove' : 'Stop upload',
            Icon: X,
            destructive: true,
            onPress: () => { if (confirm) cancelProVideoUpload(confirm.key); },
          },
        ]}
      />
    </View>
  );
}

function Bar({ upload, onStop }: { upload: ProVideoUpload; onStop: () => void }) {
  const failed = upload.phase === 'failed';
  const waiting = upload.phase === 'retrying' || upload.phase === 'offline';
  const progress = upload.phase === 'preparing'
    ? upload.prepared
    : upload.total ? upload.sent / upload.total : 0;

  const fill = useRef(new Animated.Value(progress)).current;
  useEffect(() => {
    Animated.timing(fill, { toValue: progress, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progress, fill]);
  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' });

  const Icon = failed ? AlertCircle : upload.phase === 'offline' ? WifiOff : CloudUpload;
  const pct = upload.phase === 'uploading' ? ` · ${Math.floor(progress * 100)}%` : '';

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Icon size={20} color={failed ? COLOR_RED : waiting ? 'rgba(255,255,255,0.65)' : colors.pro} />
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>{upload.title}{pct}</Text>
          <Text style={[styles.sub, failed && styles.subFailed]} numberOfLines={2}>{describeProgress(upload)}</Text>
        </View>
        {failed && upload.canRetry ? (
          <TouchableOpacity style={styles.btn} onPress={() => retryProVideoUpload(upload.key)} hitSlop={6} accessibilityLabel="Retry upload">
            <RotateCcw size={16} color={COLOR_WHITE} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.btn} onPress={onStop} hitSlop={6} accessibilityLabel={failed ? 'Remove upload' : 'Stop upload'}>
          <X size={16} color={COLOR_WHITE} />
        </TouchableOpacity>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.bar, { width, backgroundColor: failed ? COLOR_RED : colors.pro }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 12 },
  card: { borderRadius: COMMON_RADIUS, backgroundColor: SURFACE_MID, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 14, lineHeight: 18, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
  sub: { fontSize: 12, lineHeight: 15, fontFamily: FONT_INTER.semibold, color: 'rgba(255,255,255,0.65)', fontVariant: ['tabular-nums'] },
  subFailed: { color: COLOR_RED },
  btn: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  track: { height: 3, backgroundColor: 'rgba(255,255,255,0.12)' },
  bar: { height: 3 },
});
