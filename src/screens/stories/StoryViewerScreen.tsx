import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useNavigation } from '@react-navigation/native';
import { useMarkStoriesSeenMutation } from '../../api/apiService';
import { imageUrl } from '../../utils/image';
import type { AppScreenProps } from '../../navigation/types';
import type { StoryGroup, Post } from '../../types/api';

type Props = AppScreenProps<'StoryViewer'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function muxHlsUrl(videoId: string): string {
  return `https://stream.mux.com/${videoId}.m3u8`;
}

// ─── Progress bars ────────────────────────────────────────────────────────────

function ProgressBars({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.progressBars}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressBar,
            i < current && styles.progressBarDone,
            i === current && styles.progressBarActive,
          ]}
        />
      ))}
    </View>
  );
}

// ─── Story video (keyed so it remounts on story change) ───────────────────────

function StoryVideo({ videoId }: { videoId: string }) {
  const player = useVideoPlayer(muxHlsUrl(videoId), (p) => {
    p.loop = true;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
    />
  );
}

// ─── Main viewer ─────────────────────────────────────────────────────────────

export default function StoryViewerScreen({ route }: Props) {
  const { groups, startGroupIndex } = route.params;
  const navigation = useNavigation();
  const [markSeen] = useMarkStoriesSeenMutation();

  const [groupIndex, setGroupIndex] = useState(startGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);

  const group: StoryGroup = groups[groupIndex];
  const story: Post | undefined = group?.stories[storyIndex];
  const user = group?.user as any;
  const username: string = user?.username ?? '';
  const profileFilename: string | undefined = user?.profile_image ?? user?.gallery?.[0]?.filename;
  const profileUri = profileFilename ? imageUrl(profileFilename) : null;

  // Mark current story seen
  useEffect(() => {
    if (story?.internal_id) {
      markSeen({ story_ids: [story.internal_id] });
    }
  }, [groupIndex, storyIndex, story?.internal_id, markSeen]);

  const handleNext = useCallback(() => {
    const isLastStory = storyIndex >= group.stories.length - 1;
    const isLastGroup = groupIndex >= groups.length - 1;

    if (!isLastStory) {
      setStoryIndex((i) => i + 1);
    } else if (!isLastGroup) {
      setGroupIndex((g) => g + 1);
      setStoryIndex(0);
    } else {
      navigation.goBack();
    }
  }, [storyIndex, groupIndex, group?.stories.length, groups.length, navigation]);

  const handlePrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1];
      setGroupIndex((g) => g - 1);
      setStoryIndex(prevGroup.stories.length - 1);
    }
  }, [storyIndex, groupIndex, groups]);

  if (!group || !story) return null;

  const isFirst = groupIndex === 0 && storyIndex === 0;
  const isLast = groupIndex === groups.length - 1 && storyIndex === group.stories.length - 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Video */}
      {story.video_id ? (
        <StoryVideo key={`${story.internal_id}`} videoId={story.video_id} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noVideo]}>
          <Text style={styles.noVideoText}>Video processing…</Text>
        </View>
      )}

      {/* Top overlay */}
      <SafeAreaView style={styles.topOverlay} edges={['top']}>
        {/* Progress bars */}
        <ProgressBars total={group.stories.length} current={storyIndex} />

        {/* User row */}
        <View style={styles.topRow}>
          <View style={styles.userInfo}>
            {profileUri ? (
              <Image source={{ uri: profileUri }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{username.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View>
              <Text style={styles.username}>@{username}</Text>
              {story.title ? (
                <Text style={styles.storyTitle} numberOfLines={1}>{story.title}</Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn} hitSlop={12}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Tap zones for prev/next */}
      <View style={styles.tapZones} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.tapLeft}
          onPress={handlePrev}
          disabled={isFirst}
          activeOpacity={1}
        />
        <TouchableOpacity
          style={styles.tapRight}
          onPress={handleNext}
          activeOpacity={1}
        />
      </View>

      {/* Bottom nav buttons */}
      <SafeAreaView style={styles.bottomOverlay} edges={['bottom']}>
        <View style={styles.bottomRow}>
          <TouchableOpacity
            onPress={handlePrev}
            disabled={isFirst}
            style={[styles.navBtn, isFirst && styles.navBtnDisabled]}
          >
            <Text style={styles.navText}>‹ Prev</Text>
          </TouchableOpacity>

          <Text style={styles.counter}>
            {storyIndex + 1} / {group.stories.length}
            {groups.length > 1 ? `  ·  ${groupIndex + 1}/${groups.length}` : ''}
          </Text>

          <TouchableOpacity
            onPress={handleNext}
            style={styles.navBtn}
          >
            <Text style={styles.navText}>{isLast ? 'Done' : 'Next ›'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#000' },
  noVideo:      { alignItems: 'center', justifyContent: 'center' },
  noVideoText:  { color: 'rgba(255,255,255,0.4)', fontSize: 16 },

  // Progress bars
  progressBars: {
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 2,
  },
  progressBar: {
    flex: 1,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  progressBarDone:   { backgroundColor: '#fff' },
  progressBarActive: { backgroundColor: '#fff' },

  // Top overlay
  topOverlay:   { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  topRow:       {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  userInfo:     { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar:       { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  avatarFallback: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarFallbackText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  username:     { color: '#fff', fontWeight: '600', fontSize: 13 },
  storyTitle:   { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  closeBtn:     { padding: 6 },
  closeText:    { color: '#fff', fontSize: 20, fontWeight: '300' },

  // Tap zones
  tapZones:     { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 5 },
  tapLeft:      { flex: 1 },
  tapRight:     { flex: 1 },

  // Bottom nav
  bottomOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bottomRow:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  navBtn:       {
    paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 24,
  },
  navBtnDisabled: { opacity: 0.3 },
  navText:      { color: '#fff', fontSize: 14, fontWeight: '600' },
  counter:      { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
});
