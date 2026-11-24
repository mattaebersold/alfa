import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Easing, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../theme/Text';
import { Image } from '../ui/AppImage';
import { useNavigation } from '@react-navigation/native';
import { AlertCircle, RotateCcw, Pencil, Trash2 } from 'lucide-react-native';
import ActionSheet from '../ui/ActionSheet';
import {
  usePostUploads, retryPostUpload, discardPostUpload, type PostUpload,
} from '../../utils/postUpload';
import { COLOR_BLACK, COLOR_RED, COLOR_SUCCESS, COLOR_WHITE } from '../../constants/config';
import { FAB_BOTTOM, FAB_BOX, FAB_LANE } from '../ui/CreateFab';
import { FONT_INTER } from '../../constants/fonts';

/** How far down a drag has to go (or how fast) before the bar is put away. */
const DISMISS_DY = 40;
const DISMISS_VY = 0.5;

/** An upload's key for hiding: its status too, so one that fails after you hid it comes back. */
const hideKey = (u: PostUpload) => `${u.id}:${u.status}`;

/**
 * The posts on their way up, fixed to the bottom of the screen beside the +
 * — over whatever you've gone on to look at. One bar each: what it's doing,
 * and how far.
 *
 * Swipe it down to put it away; the post keeps going up regardless. A failed
 * one comes back (in red) even if you'd hidden it, and a tap offers to try it
 * again, to put it back in the form, or to throw it away.
 *
 * Rendered once by MainTabNavigator, beside CreateFab.
 */
export default function PostUploadBanner() {
  const uploads = usePostUploads();
  const insets = useSafeAreaInsets();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const navigation = useNavigation<any>();

  const visible = uploads.filter((u) => !hidden.has(hideKey(u)));
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  // Drag down to dismiss; anything short of that settles back.
  const drag = useRef(new Animated.Value(0)).current;
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_, g) => {
      if (g.dy > DISMISS_DY || g.vy > DISMISS_VY) {
        Animated.timing(drag, { toValue: 200, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true })
          .start(() => {
            const keys = visibleRef.current.map(hideKey);
            setHidden((prev) => new Set([...prev, ...keys]));
          });
      } else {
        Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
    },
  }), [drag]);

  // Back in place for whatever shows next.
  const showing = visible.length > 0;
  useEffect(() => { if (showing) drag.setValue(0); }, [showing, drag]);

  // Forget hidden ones once they've finished.
  useEffect(() => {
    setHidden((prev) => {
      const live = new Set(uploads.map(hideKey));
      const next = new Set([...prev].filter((k) => live.has(k)));
      return next.size === prev.size ? prev : next;
    });
  }, [uploads]);

  return (
    <>
      {showing ? (
        <Animated.View
          {...pan.panHandlers}
          style={[styles.wrap, { bottom: insets.bottom + FAB_BOTTOM, transform: [{ translateY: drag }] }]}
        >
          {visible.map((u) => (
            <UploadBar key={u.id} upload={u} onPress={() => u.status === 'failed' && setMenuFor(u.id)} />
          ))}
        </Animated.View>
      ) : null}
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
    </>
  );
}

function UploadBar({ upload, onPress }: { upload: PostUpload; onPress: () => void }) {
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
          {/* While it's going up the bar says how far — no number beside it. */}
          {failed ? (
            <Text style={styles.sub} numberOfLines={1}>Tap to try again or edit</Text>
          ) : null}
        </View>
        {failed ? <AlertCircle size={20} color={COLOR_RED} strokeWidth={2.2} /> : null}
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.bar, { width, backgroundColor: failed ? COLOR_RED : COLOR_SUCCESS }]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Fixed along the bottom, in the + button's row and clear of it on the
  // right. At least the button's height, so a single bar centres on it; more
  // stack upward.
  wrap: {
    position: 'absolute', left: 12, right: FAB_LANE,
    minHeight: FAB_BOX, justifyContent: 'center',
    gap: 8, zIndex: 29,
  },
  card: {
    borderRadius: 16, backgroundColor: COLOR_BLACK, overflow: 'hidden',
    boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.35)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  thumb: { width: 36, height: 36, borderRadius: 8 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 14, lineHeight: 18, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
  sub: { fontSize: 12, lineHeight: 15, fontFamily: FONT_INTER.semibold, color: 'rgba(255,255,255,0.65)', fontVariant: ['tabular-nums'] },
  track: { height: 3, backgroundColor: 'rgba(255,255,255,0.12)' },
  bar: { height: 3 },
});
