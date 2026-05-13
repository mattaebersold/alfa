import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import type { Podcast, PodcastEpisode } from '../../types/api';

const SPEED_STEPS = [0.75, 1.0, 1.25, 1.5, 2.0];

const formatTime = (secs: number): string => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

interface Props {
  episode: PodcastEpisode;
  podcast: Podcast;
  onClose: () => void;
}

export default function PodcastPlayer({ episode, podcast, onClose }: Props) {
  const colors = useColors();
  const [speedIndex, setSpeedIndex] = useState(1);
  const hasAutoPlayed = useRef(false);

  const player = useAudioPlayer({ uri: episode.audio_url });
  const status = useAudioPlayerStatus(player);

  const artwork = podcast.artwork_filename ? imageUrl(podcast.artwork_filename) : null;

  useEffect(() => {
    setAudioModeAsync({ playsInSilentModeIOS: true });
  }, []);

  // Auto-play once loaded
  useEffect(() => {
    if (status.isLoaded && !hasAutoPlayed.current) {
      hasAutoPlayed.current = true;
      player.play();
    }
  }, [status.isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply speed changes
  useEffect(() => {
    if (status.isLoaded) {
      player.setPlaybackRate(SPEED_STEPS[speedIndex]);
    }
  }, [speedIndex, status.isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLoading = !status.isLoaded;
  const isPlaying = status.playing ?? false;
  const positionSecs = status.currentTime ?? 0;
  const durationSecs = status.duration ?? 0;

  const togglePlay = () => {
    if (isPlaying) player.pause();
    else player.play();
  };

  const skip = (seconds: number) => {
    const next = Math.max(0, Math.min(positionSecs + seconds, durationSecs));
    player.seekTo(next);
  };

  const cycleSpeed = () => {
    setSpeedIndex(prev => (prev + 1) % SPEED_STEPS.length);
  };

  const progress = durationSecs > 0 ? positionSecs / durationSecs : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: colors.fg }]} />
      </View>

      <View style={styles.inner}>
        {/* Artwork */}
        {artwork ? (
          <Image source={{ uri: artwork }} style={styles.artwork} contentFit="cover" />
        ) : (
          <View style={[styles.artworkPlaceholder, { backgroundColor: colors.border }]}>
            <Text style={{ fontSize: 20 }}>🎙️</Text>
          </View>
        )}

        {/* Info */}
        <View style={styles.info}>
          <Text style={[styles.episodeTitle, { color: colors.fg }]} numberOfLines={1}>{episode.title}</Text>
          <Text style={[styles.showTitle, { color: colors.grey }]} numberOfLines={1}>{podcast.title}</Text>
          <Text style={[styles.time, { color: colors.muted }]}>
            {formatTime(positionSecs)} / {formatTime(durationSecs)}
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {/* Skip back */}
          <TouchableOpacity onPress={() => skip(-15)} style={styles.iconBtn} hitSlop={8}>
            <Text style={[styles.skipLabel, { color: colors.muted }]}>-15</Text>
          </TouchableOpacity>

          {/* Play/Pause */}
          <TouchableOpacity onPress={togglePlay} style={[styles.playBtn, { backgroundColor: colors.fg }]} hitSlop={4}>
            {isLoading ? (
              <ActivityIndicator color={colors.card} size="small" />
            ) : isPlaying ? (
              <View style={styles.pauseIcon}>
                <View style={[styles.pauseBar, { backgroundColor: colors.card }]} />
                <View style={[styles.pauseBar, { backgroundColor: colors.card }]} />
              </View>
            ) : (
              <View style={[styles.playIcon, { borderLeftColor: colors.card }]} />
            )}
          </TouchableOpacity>

          {/* Skip forward */}
          <TouchableOpacity onPress={() => skip(15)} style={styles.iconBtn} hitSlop={8}>
            <Text style={[styles.skipLabel, { color: colors.muted }]}>+15</Text>
          </TouchableOpacity>

          {/* Speed */}
          <TouchableOpacity onPress={cycleSpeed} style={[styles.speedBtn, { borderColor: colors.border }]} hitSlop={8}>
            <Text style={[styles.speedText, { color: colors.muted }]}>{SPEED_STEPS[speedIndex]}x</Text>
          </TouchableOpacity>
        </View>

        {/* Close */}
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
          <Text style={[styles.closeText, { color: colors.grey }]}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { borderTopWidth: 1 },
  progressTrack:    { height: 3 },
  progressFill:     { height: '100%' },
  inner:            {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  artwork:          { width: 44, height: 44, borderRadius: 6 },
  artworkPlaceholder: { width: 44, height: 44, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  info:             { flex: 1, gap: 1 },
  episodeTitle:     { fontSize: 12, fontWeight: '700' },
  showTitle:        { fontSize: 11 },
  time:             { fontSize: 10 },
  controls:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn:          { padding: 4 },
  skipLabel:        { fontSize: 11, fontWeight: '700' },
  playBtn:          {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  pauseIcon:        { flexDirection: 'row', gap: 3, alignItems: 'center', justifyContent: 'center' },
  pauseBar:         { width: 3, height: 14, borderRadius: 2 },
  playIcon:         {
    width: 0, height: 0,
    borderTopWidth: 7, borderBottomWidth: 7, borderLeftWidth: 12,
    borderTopColor: 'transparent', borderBottomColor: 'transparent',
    marginLeft: 2,
  },
  speedBtn:         { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  speedText:        { fontSize: 10, fontWeight: '700' },
  closeBtn:         { padding: 4 },
  closeText:        { fontSize: 16 },
});
