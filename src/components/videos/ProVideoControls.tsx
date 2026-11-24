import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, TouchableOpacity, PanResponder, Animated, type LayoutChangeEvent } from 'react-native';
import type { VideoPlayer } from 'expo-video';
import { Play, Pause, RotateCcw, Maximize } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import { colors } from '../../constants/colors';
import { COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import { formatDuration } from '../../types/proVideos';

/** How long the controls stay up after a tap while it's playing. */
const HIDE_AFTER_MS = 2800;
/** The scrubber's touch area — far taller than the line it draws. */
const TRACK_HIT = 28;

/**
 * Our own controls over a Pro video, in place of iOS's — which come as a set,
 * mute button and all, with no way to leave one out. Play / pause in the
 * middle; along the foot the time, a scrubber you can tap or drag, the
 * length, and full screen (`onFullscreen` — the viewer hands that to the
 * system's own player, controls and all, since ours can't follow it there).
 *
 * A tap on the video shows them; while it's playing they fade after a few
 * seconds. Paused or finished, they stay.
 */
export default function ProVideoControls({ player, onFullscreen, bottomInset = 0 }: {
  player: VideoPlayer;
  onFullscreen: () => void;
  /** Extra room under the bar — none when the video's in the page. */
  bottomInset?: number;
}) {
  const [playing, setPlaying] = useState(player.playing);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(player.duration || 0);
  /** Where a drag on the scrubber is, 0–1; null when nobody's dragging. */
  const [scrub, setScrub] = useState<number | null>(null);
  const [shown, setShown] = useState(true);
  const fade = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackW = useRef(1);

  useEffect(() => {
    player.timeUpdateEventInterval = 0.25;
    const subs = [
      player.addListener('playingChange', ({ isPlaying }) => setPlaying(isPlaying)),
      player.addListener('timeUpdate', ({ currentTime }) => {
        setTime(currentTime);
        if (player.duration && player.duration !== duration) setDuration(player.duration);
      }),
      player.addListener('sourceLoad', ({ duration: d }) => { if (d) setDuration(d); }),
    ];
    return () => subs.forEach((s) => s.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  const ended = duration > 0 && !playing && time >= duration - 0.5;

  // Showing and hiding: up on a tap, down on their own only while it plays.
  const show = useCallback((on: boolean) => {
    setShown(on);
    Animated.timing(fade, { toValue: on ? 1 : 0, duration: on ? 150 : 300, useNativeDriver: true }).start();
  }, [fade]);
  const armHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { if (player.playing) show(false); }, HIDE_AFTER_MS);
  }, [player, show]);
  useEffect(() => {
    if (playing && scrub === null) armHide();
    else { if (hideTimer.current) clearTimeout(hideTimer.current); show(true); }
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [playing, scrub, armHide, show]);

  const toggle = () => {
    if (ended) player.replay();
    else if (playing) player.pause();
    else player.play();
    armHide();
  };

  const fractionAt = (x: number) => Math.max(0, Math.min(1, x / trackW.current));
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    // A drag across the scrubber mustn't become the page's scroll.
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => setScrub(fractionAt(e.nativeEvent.locationX)),
    onPanResponderMove: (e) => setScrub(fractionAt(e.nativeEvent.locationX)),
    onPanResponderRelease: (e) => {
      const f = fractionAt(e.nativeEvent.locationX);
      if (player.duration) { player.currentTime = f * player.duration; setTime(f * player.duration); }
      setScrub(null);
    },
    onPanResponderTerminate: () => setScrub(null),
  })).current;

  const progress = scrub ?? (duration ? Math.min(1, time / duration) : 0);
  const shownTime = scrub !== null ? scrub * duration : time;

  return (
    <>
      {/* The whole video: a tap shows the controls, or hides them if they're up. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => (shown ? show(false) : (show(true), armHide()))} accessibilityLabel="Show video controls" />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]} pointerEvents={shown ? 'box-none' : 'none'}>
        <View style={styles.scrim} pointerEvents="none" />
        <View style={styles.center} pointerEvents="box-none">
          <TouchableOpacity style={styles.playDisc} onPress={toggle} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={ended ? 'Play again' : playing ? 'Pause' : 'Play'}>
            {ended ? <RotateCcw size={26} color={COLOR_WHITE} />
              : playing ? <Pause size={28} color={COLOR_WHITE} fill={COLOR_WHITE} />
              : <Play size={28} color={COLOR_WHITE} fill={COLOR_WHITE} style={styles.playGlyph} />}
          </TouchableOpacity>
        </View>
        <View style={[styles.bar, { paddingBottom: 10 + bottomInset }]}>
          <Text style={styles.time}>{formatDuration(shownTime) || '0:00'}</Text>
          <View
            style={styles.trackHit}
            onLayout={(e: LayoutChangeEvent) => { trackW.current = Math.max(1, e.nativeEvent.layout.width); }}
            {...pan.panHandlers}
            accessibilityRole="adjustable"
            accessibilityLabel="Seek"
          >
            <View style={styles.track} pointerEvents="none">
              <View style={[styles.fill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={[styles.knob, { left: `${progress * 100}%` }, scrub !== null && styles.knobActive]} pointerEvents="none" />
          </View>
          <Text style={styles.time}>{formatDuration(duration) || '0:00'}</Text>
          <TouchableOpacity onPress={onFullscreen} hitSlop={10} accessibilityRole="button" accessibilityLabel="Full screen">
            <Maximize size={18} color={COLOR_WHITE} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  // Darkened toward the foot so the bar reads on any frame.
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 80, backgroundColor: 'rgba(0,0,0,0.35)' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  playDisc: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  playGlyph: { marginLeft: 4 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  time: { color: COLOR_WHITE, fontSize: 12, fontFamily: FONT_INTER.semibold, fontVariant: ['tabular-nums'], minWidth: 34, textAlign: 'center' },
  trackHit: { flex: 1, height: TRACK_HIT, justifyContent: 'center' },
  track: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  fill: { height: 3, backgroundColor: colors.pro },
  knob: { position: 'absolute', width: 12, height: 12, borderRadius: 6, marginLeft: -6, backgroundColor: COLOR_WHITE, top: (TRACK_HIT - 12) / 2 },
  knobActive: { transform: [{ scale: 1.3 }] },
});
