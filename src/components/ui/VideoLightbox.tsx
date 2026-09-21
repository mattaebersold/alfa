import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COMMON_RADIUS } from '../../constants/radius';
import { muxStreamUrl } from '../../utils/postMedia';

/** The close button's box, and the breathing room either side of it. */
const CLOSE_SIZE = 38;
const CLOSE_GAP = 8;

export interface VideoLightboxProps {
  /** The Mux playback id to watch. Null when there's nothing open. */
  videoId: string | null;
  onClose: () => void;
}

/**
 * Full-screen video viewer — the video counterpart to ImageLightbox, with the
 * same close button in the same corner.
 *
 * A video tapped in a feed card used to play inside the card, at whatever shape
 * the post's first photo gave the strip: a portrait clip in a landscape strip
 * played as a sliver between two black bars. Here it gets the whole screen at
 * its own proportions, and leaving it is one obvious button rather than
 * scrolling away or finding the pause control.
 *
 * ## The player lives here, not with the poster
 *
 * It's created when the viewer opens and released when it closes, so a feed of
 * fifty video posts holds no players at all until one is actually watched —
 * and never more than one, since there's only one viewer on screen. Closing is
 * therefore also the stop: there's no player left to keep making noise.
 */
export default function VideoLightbox({ videoId, onClose }: VideoLightboxProps) {
  if (!videoId) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* Keyed so that swapping one video for another is a fresh player rather
          than the old one retargeted mid-playback. */}
      <Viewer key={videoId} videoId={videoId} onClose={onClose} />
    </Modal>
  );
}

function Viewer({ videoId, onClose }: { videoId: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  // The tap that opened this was the request to play, so it starts on its own.
  const player = useVideoPlayer(muxStreamUrl(videoId), (p) => {
    p.loop = false;
    p.play();
  });

  return (
    <View style={styles.root}>
      {/* The video sits below the close button rather than under it. The native
          controls put their own buttons in the video's top corners — mute is
          top right on iOS — and a close button floating over them would cover
          one and sit a few points from being mistaken for the other. */}
      <View
        style={[
          styles.stage,
          { marginTop: insets.top + CLOSE_GAP * 2 + CLOSE_SIZE, marginBottom: insets.bottom },
        ]}
      >
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls
        />
      </View>

      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + CLOSE_GAP }]}
        onPress={onClose}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Close video"
      >
        <X size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // Solid black, unlike the photo viewer's near-black: a video's letterboxing
  // is black already, and a second, slightly lighter black around it would
  // draw the edge of the player as a visible box.
  root:  { flex: 1, backgroundColor: '#000' },
  stage: { flex: 1 },
  closeBtn: {
    position: 'absolute', right: 14,
    width: CLOSE_SIZE, height: CLOSE_SIZE, borderRadius: COMMON_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
});
