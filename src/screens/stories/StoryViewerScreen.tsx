import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useNavigation } from '@react-navigation/native';
import { useMarkStoriesSeenMutation } from '../../api/apiService';
import { imageUrl } from '../../utils/image';
import LikeButton from '../../components/social/LikeButton';
import type { AppScreenProps } from '../../navigation/types';
import type { StoryGroup, Post } from '../../types/api';

type Props = AppScreenProps<'StoryViewer'>;

const MAX_DURATION = 30; // seconds — matches recording max

function muxHlsUrl(videoId: string): string {
  return `https://stream.mux.com/${videoId}.m3u8`;
}

// ─── Animated progress bars ───────────────────────────────────────────────────

function ProgressBars({
  total,
  current,
  progressAnim,
}: {
  total: number;
  current: number;
  progressAnim: Animated.Value;
}) {
  return (
    <View style={styles.progressBars}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={styles.progressBarTrack}>
          {i < current ? (
            // Completed — fully white
            <View style={[styles.progressBarFill, { width: '100%' }]} />
          ) : i === current ? (
            // Active — animated
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          ) : null /* future — track only */}
        </View>
      ))}
    </View>
  );
}

// ─── Story video ─────────────────────────────────────────────────────────────

function StoryVideo({
  videoId,
  onBufferingChange,
}: {
  videoId: string;
  onBufferingChange: (buffering: boolean) => void;
}) {
  const player = useVideoPlayer(muxHlsUrl(videoId), (p) => {
    p.loop = true;
    p.play();
  });

  useEffect(() => {
    // New video always starts buffering
    onBufferingChange(true);
    const sub = player.addListener('statusChange', ({ status }: { status: string }) => {
      onBufferingChange(status === 'loading' || status === 'idle');
    });
    return () => sub.remove();
  }, [player]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
    />
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function StoryViewerScreen({ route }: Props) {
  const { groups, startGroupIndex } = route.params;
  const navigation = useNavigation();
  const [markSeen] = useMarkStoriesSeenMutation();

  const [groupIndex, setGroupIndex] = useState(startGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const group: StoryGroup = groups[groupIndex];
  const story: Post | undefined = group?.stories[storyIndex];
  const user = group?.user as any;
  const username: string = user?.username ?? '';
  const profileFilename: string | undefined = user?.profile_image ?? user?.gallery?.[0]?.filename;
  const profileUri = profileFilename ? imageUrl(profileFilename) : null;

  // Reset buffering indicator on story change
  useEffect(() => {
    setIsBuffering(true);
  }, [groupIndex, storyIndex]);

  // Animate progress bar for current story
  useEffect(() => {
    animRef.current?.stop();
    progressAnim.setValue(0);
    animRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: MAX_DURATION * 1000,
      useNativeDriver: false,
    });
    animRef.current.start();
    return () => animRef.current?.stop();
  }, [groupIndex, storyIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark story seen
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
      {/* Video */}
      {story.video_id ? (
        <StoryVideo
          key={`${story.internal_id}`}
          videoId={story.video_id}
          onBufferingChange={setIsBuffering}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noVideo]}>
          <Text style={styles.noVideoText}>Video processing…</Text>
        </View>
      )}

      {/* Buffering spinner */}
      {isBuffering && (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="rgba(255,255,255,0.85)" />
        </View>
      )}

      {/* Top overlay: progress bars + user */}
      <SafeAreaView style={styles.topOverlay} edges={['top']}>
        <ProgressBars
          total={group.stories.length}
          current={storyIndex}
          progressAnim={progressAnim}
        />
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

      {/* Tap zones */}
      <View style={styles.tapZones} pointerEvents="box-none">
        <TouchableOpacity style={styles.tapLeft} onPress={handlePrev} disabled={isFirst} activeOpacity={1} />
        <TouchableOpacity style={styles.tapRight} onPress={handleNext} activeOpacity={1} />
      </View>

      {/* Bottom bar: prev / like / next */}
      <SafeAreaView style={styles.bottomOverlay} edges={['bottom']}>
        <View style={styles.bottomRow}>
          <TouchableOpacity
            onPress={handlePrev}
            disabled={isFirst}
            style={[styles.navBtn, isFirst && styles.navBtnDisabled]}
          >
            <Text style={styles.navText}>‹ Prev</Text>
          </TouchableOpacity>

          {/* Like button */}
          <View style={styles.likeWrapper}>
            <LikeButton
              documentId={story.internal_id}
              entryType="post"
              initialLiked={story.isLiked ?? false}
              initialCount={story.likeCount ?? 0}
              showCount
            />
          </View>

          <TouchableOpacity onPress={handleNext} style={styles.navBtn}>
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
  progressBarTrack: {
    flex: 1,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },

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

  // Bottom bar
  bottomOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bottomRow:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  navBtn:         {
    paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 24,
  },
  navBtnDisabled: { opacity: 0.3 },
  navText:        { color: '#fff', fontSize: 14, fontWeight: '600' },
  likeWrapper:    { alignItems: 'center' },
});
