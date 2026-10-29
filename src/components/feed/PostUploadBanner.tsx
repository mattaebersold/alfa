import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from '../ui/AppImage';
import { useNavigation } from '@react-navigation/native';
import { AlertCircle, RotateCcw, Pencil, Trash2 } from 'lucide-react-native';
import ActionSheet from '../ui/ActionSheet';
import { useBrandColor } from '../../hooks/useBrandColor';
import {
  usePostUploads, retryPostUpload, discardPostUpload, type PostUpload,
} from '../../utils/postUpload';
import { COMMON_RADIUS, COLOR_GRAY_26, COLOR_RED, COLOR_WHITE, GUTTER } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * The posts on their way up, at the top of the home feed — under the tabs,
 * over the auction and the rows. One bar each: what it's doing, and how far.
 *
 * Gone once its post lands (the feed refreshes to show it — see FeedScreen).
 * A failed one stays, in red, and a tap offers to try it again, to put it
 * back in the form, or to throw it away.
 */
export default function PostUploadBanner() {
  const uploads = usePostUploads();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const navigation = useNavigation<any>();

  if (uploads.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {uploads.map((u) => (
        <UploadBar key={u.id} upload={u} onPress={() => u.status === 'failed' && setMenuFor(u.id)} />
      ))}
      <ActionSheet
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title="Your post didn't go up"
        message={uploads.find((u) => u.id === menuFor)?.error}
        options={[
          { label: 'Try again', Icon: RotateCcw, onPress: () => { if (menuFor) retryPostUpload(menuFor); } },
          { label: 'Edit post', Icon: Pencil, onPress: () => { if (menuFor) navigation.navigate('Create', { draftId: menuFor }); } },
          { label: 'Discard', Icon: Trash2, destructive: true, onPress: () => { if (menuFor) discardPostUpload(menuFor); } },
        ]}
      />
    </View>
  );
}

function UploadBar({ upload, onPress }: { upload: PostUpload; onPress: () => void }) {
  const brand = useBrandColor();
  const failed = upload.status === 'failed';

  // Eased toward each new reading rather than jumping to it.
  const fill = useRef(new Animated.Value(upload.progress)).current;
  useEffect(() => {
    Animated.timing(fill, {
      toValue: upload.progress,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [upload.progress, fill]);
  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' });

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={failed ? 0.8 : 1}
      disabled={!failed}
      accessibilityRole={failed ? 'button' : undefined}
      accessibilityLabel={failed ? 'Post failed. Tap to retry or edit.' : `${upload.label} ${Math.round(upload.progress * 100)}%`}
    >
      <View style={styles.row}>
        {upload.thumb ? (
          <Image source={{ uri: upload.thumb }} style={styles.thumb} contentFit="cover" />
        ) : null}
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {failed ? "Couldn't post" : upload.label}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {failed ? 'Tap to try again or edit' : `${Math.round(upload.progress * 100)}%`}
          </Text>
        </View>
        {failed ? <AlertCircle size={20} color={COLOR_RED} strokeWidth={2.2} /> : null}
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.bar, { width, backgroundColor: failed ? COLOR_RED : brand }]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // A little clear of the header's tabs above, as the auction banner is.
  wrap: { paddingTop: 12, paddingHorizontal: GUTTER, gap: 8 },
  card: {
    borderRadius: COMMON_RADIUS, backgroundColor: COLOR_GRAY_26, overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  thumb: { width: 36, height: 36, borderRadius: 6 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 14, lineHeight: 18, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
  sub: { fontSize: 12, lineHeight: 15, fontFamily: FONT_INTER.semibold, color: 'rgba(255,255,255,0.65)', fontVariant: ['tabular-nums'] },
  track: { height: 3, backgroundColor: 'rgba(255,255,255,0.12)' },
  bar: { height: 3 },
});
