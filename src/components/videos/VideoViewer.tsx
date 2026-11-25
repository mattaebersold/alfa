import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, useWindowDimensions, Image as RNImage } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProVideoControls from './ProVideoControls';
import { Text } from '../../theme/Text';
import FormScrollView from '../../keyboard/FormScrollView';
import KeyboardAvoidingView from '../../keyboard/KeyboardAvoidingView';
import { PortalHost } from '../Portal';
import InlineComments from '../social/InlineComments';
import { muxHls, muxPoster } from '../../types/proVideos';
import { COLOR_BLACK, COLOR_WHITE, PILL_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

const CLOSE_SIZE = 38;

/**
 * A Mux video, full screen over everything — the one viewer behind a Pro
 * video (ProVideoOverlay) and a home message (HomeMessageViewer), so the two
 * look and behave alike.
 *
 * The video at the very top, as wide as the screen and as tall as its own
 * shape makes it, playing as it opens, with our own controls on it
 * (ProVideoControls — iOS's set can't leave its mute button out) and the
 * close button floating over its corner. Under it an optional line above the
 * title (`eyebrow`), the title, the description, the caller's buttons inline
 * (`actions`), and the comments straight on the black. `children` is for what
 * the caller opens over it — an owner's menu, an edit sheet — rendered inside
 * this modal so it can show on top.
 *
 * Closing it stops the video (the player goes with the viewer). Key it by the
 * thing it plays, so another one is a fresh player.
 */
export default function VideoViewer({
  playbackId, fallbackAspect = 16 / 9, onClose, onFirstPlay,
  eyebrow, title, description, actions, comments, children,
}: {
  playbackId: string;
  /** Width over height, until the real shape is read off Mux's thumbnail. */
  fallbackAspect?: number;
  onClose: () => void;
  /** Once, when it first actually starts playing — for counting a view. */
  onFirstPlay?: () => void;
  eyebrow?: string | null;
  title: string;
  description?: string | null;
  actions?: React.ReactNode;
  comments: { documentId: string; entryType: string };
  children?: React.ReactNode;
}) {
  /**
   * Whether the modal is actually on screen. Playback waits for it: iOS can
   * decline to present a modal raised mid-launch or mid-transition, and a
   * player started before that was sound with nothing to see or stop it.
   */
  const [shown, setShown] = useState(false);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} onShow={() => setShown(true)} statusBarTranslucent>
      <PortalHost>
        <Viewer
          shown={shown}
          playbackId={playbackId}
          fallbackAspect={fallbackAspect}
          onClose={onClose}
          onFirstPlay={onFirstPlay}
          eyebrow={eyebrow}
          title={title}
          description={description}
          actions={actions}
          comments={comments}
        >
          {children}
        </Viewer>
      </PortalHost>
    </Modal>
  );
}

function Viewer({
  shown, playbackId, fallbackAspect, onClose, onFirstPlay, eyebrow, title, description, actions, comments, children,
}: React.ComponentProps<typeof VideoViewer> & { fallbackAspect: number; shown: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  /**
   * The screen's width, and the video's own height at that width. The saved
   * aspect is often missing (so 16:9), and a portrait clip drawn in a
   * landscape box played small, black all round it — see below.
   */
  const [aspect, setAspect] = useState(fallbackAspect);
  const stageH = Math.round(width / aspect);
  const viewRef = useRef<VideoView>(null);
  /**
   * The system's own controls, only while full screen: ours can't follow the
   * video there, and without any it couldn't be left. Switched on, then the
   * view asked to go full screen once that's applied; off again on the way out.
   */
  const [systemControls, setSystemControls] = useState(false);
  const goFullscreen = () => {
    setSystemControls(true);
    setTimeout(() => { viewRef.current?.enterFullscreen().catch(() => setSystemControls(false)); }, 60);
  };

  // The tap that opened this was the request to play — started once the
  // modal is really up (`shown`), never before.
  const player = useVideoPlayer(muxHls(playbackId), (p) => {
    p.loop = false;
  });
  const started = useRef(false);
  useEffect(() => {
    if (!shown || started.current) return;
    started.current = true;
    player.play();
  }, [shown, player]);

  /**
   * The true shape from the video's own thumbnail: Mux renders it the right
   * way up at the video's real proportions. The stream's reported size can't
   * be trusted for this — a phone clip is stored sideways with a rotation
   * flag, so it reads as landscape.
   */
  useEffect(() => {
    let live = true;
    RNImage.getSize(
      muxPoster(playbackId, 480),
      (w, h) => { if (live && w > 0 && h > 0) setAspect(w / h); },
      () => {},
    );
    return () => { live = false; };
  }, [playbackId]);

  // Once per open, when it's actually playing — not on open, so a tap in and straight back out isn't a view.
  const played = useRef(false);
  const firstPlay = useRef(onFirstPlay);
  firstPlay.current = onFirstPlay;
  useEffect(() => {
    const sub = player.addListener('playingChange', ({ isPlaying }) => {
      if (isPlaying && !played.current) {
        played.current = true;
        firstPlay.current?.();
      }
    });
    return () => sub.remove();
  }, [player]);

  return (
    <KeyboardAvoidingView style={styles.root}>
      <FormScrollView
        // The video starts at the very top of the screen, under the status bar.
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width, height: stageH }}>
          <VideoView
            ref={viewRef}
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            nativeControls={systemControls}
            fullscreenOptions={{ enable: true }}
            onFullscreenExit={() => setSystemControls(false)}
          />
          {!systemControls ? <ProVideoControls player={player} onFullscreen={goFullscreen} /> : null}
        </View>
        <View style={styles.info}>
          {eyebrow ? <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text> : null}
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
          {/* The caller's buttons, inline under the description. */}
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
        {/* Bare and see-through: no rule or panel of its own, just the thread on the black. */}
        <View style={styles.comments}>
          <InlineComments documentId={comments.documentId} entryType={comments.entryType} bare backgroundColor="transparent" />
        </View>
      </FormScrollView>

      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 8 }]}
        onPress={onClose}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Close video"
      >
        <X size={20} color={COLOR_WHITE} />
      </TouchableOpacity>

      {children}
    </KeyboardAvoidingView>
  );
}

/**
 * One of the viewer's inline buttons — an icon and its count, no pill — for
 * the callers' like / save / cog. Pass it as `style` to LikeButton too.
 */
export const viewerActionStyle = { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34 } as const;
export const viewerCountStyle = { color: COLOR_WHITE, fontSize: 13, fontFamily: FONT_INTER.medium } as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR_BLACK },
  info: { paddingHorizontal: 16, paddingTop: 14, gap: 10 },
  eyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: FONT_INTER.medium },
  title: { fontSize: 17, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
  description: { color: 'rgba(255,255,255,0.88)', fontSize: 14.5, lineHeight: 21 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 2 },
  comments: { paddingTop: 24 },
  closeBtn: {
    position: 'absolute', right: 14,
    width: CLOSE_SIZE, height: CLOSE_SIZE, borderRadius: PILL_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
});
