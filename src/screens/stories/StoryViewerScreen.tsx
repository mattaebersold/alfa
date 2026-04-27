import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, SafeAreaView,
} from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useNavigation } from '@react-navigation/native';
import { useMarkStoriesSeenMutation } from '../../api/apiService';
import { imageUrl } from '../../utils/image';
import type { AppScreenProps } from '../../navigation/types';
import type { Post } from '../../types/api';

type Props = AppScreenProps<'StoryViewer'>;

function muxHlsUrl(videoId: string): string {
  return `https://stream.mux.com/${videoId}.m3u8`;
}

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

export default function StoryViewerScreen({ route }: Props) {
  const { stories, startIndex } = route.params;
  const navigation = useNavigation();
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [markSeen] = useMarkStoriesSeenMutation();

  const story: Post = stories[currentIndex];
  const user = (story?.user_objectid ?? story?.user) as any;
  const username: string = user?.username ?? '';
  const profileFilename: string | undefined = user?.profile_image ?? user?.gallery?.[0]?.filename;
  const profileUri = profileFilename ? imageUrl(profileFilename) : null;

  useEffect(() => {
    if (story?.internal_id) {
      markSeen({ story_ids: [story.internal_id] });
    }
  }, [currentIndex, story?.internal_id, markSeen]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(stories.length - 1, i + 1));
  }, [stories.length]);

  if (!story) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Video */}
      {story.video_id ? (
        <StoryVideo key={`${story.internal_id}-${currentIndex}`} videoId={story.video_id} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noVideo]}>
          <Text style={styles.noVideoText}>Video processing…</Text>
        </View>
      )}

      {/* Top overlay */}
      <SafeAreaView style={styles.topOverlay}>
        <View style={styles.topRow}>
          <View style={styles.userInfo}>
            {profileUri && (
              <Image source={{ uri: profileUri }} style={styles.avatar} contentFit="cover" />
            )}
            <View>
              <Text style={styles.username}>@{username}</Text>
              {story.title ? <Text style={styles.storyTitle} numberOfLines={1}>{story.title}</Text> : null}
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn} hitSlop={12}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bottom navigation */}
      <View style={styles.bottomOverlay}>
        <TouchableOpacity
          onPress={handlePrev}
          disabled={currentIndex === 0}
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
        >
          <Text style={styles.navText}>‹ Prev</Text>
        </TouchableOpacity>

        <Text style={styles.counter}>{currentIndex + 1} / {stories.length}</Text>

        <TouchableOpacity
          onPress={handleNext}
          disabled={currentIndex === stories.length - 1}
          style={[styles.navBtn, currentIndex === stories.length - 1 && styles.navBtnDisabled]}
        >
          <Text style={styles.navText}>Next ›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#000' },
  noVideo:        { alignItems: 'center', justifyContent: 'center' },
  noVideoText:    { color: 'rgba(255,255,255,0.4)', fontSize: 16 },

  topOverlay:     { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  topRow:         {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  userInfo:       { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar:         { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  username:       { color: '#fff', fontWeight: '600', fontSize: 13 },
  storyTitle:     { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  closeBtn:       { padding: 6 },
  closeText:      { color: '#fff', fontSize: 20, fontWeight: '300' },

  bottomOverlay:  {
    position: 'absolute', bottom: 40, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  navBtn:         { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 24 },
  navBtnDisabled: { opacity: 0.3 },
  navText:        { color: '#fff', fontSize: 15, fontWeight: '600' },
  counter:        { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
});
