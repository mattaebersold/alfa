import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Bookmark, Settings, Pencil, Trash2, Eye } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow } from 'date-fns';
import { Text } from '../../theme/Text';
import FormScrollView from '../../keyboard/FormScrollView';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import ActionSheet from '../../components/ui/ActionSheet';
import LikeButton from '../../components/social/LikeButton';
import CommentButton from '../../components/social/CommentButton';
import InlineComments from '../../components/social/InlineComments';
import ProVideoDetailsSheet from '../../components/videos/ProVideoDetailsSheet';
import { authorName } from '../../components/videos/ProVideoCard';
import {
  useGetProVideoQuery, useGetProVideoMetaQuery, useCountProVideoViewMutation,
  useToggleProVideoBookmarkMutation, useDeleteProVideoMutation, patchProVideoCaches,
} from '../../api/apiService';
import { store, useAppSelector } from '../../store/store';
import { forgetProVideo } from '../../utils/proVideoUpload';
import { formatActionCount } from '../../utils/text';
import { colors } from '../../constants/colors';
import { APP_BG, COLOR_BLACK, COLOR_GRAY_160, COLOR_WHITE, GUTTER, SURFACE_MID, PILL_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import { aspectOf, formatDuration, muxHls, type ProVideo } from '../../types/proVideos';
import type { FeedStackParamList } from '../../navigation/types';

/** The entry type likes and comments on a Pro video are filed under (horacio's contentRef). */
const ENTRY_TYPE = 'provideo';

/**
 * A Pro video, playing: Mux's HLS stream in the native player (its own
 * controls, fullscreen, AirPlay/PiP where the platform has them), and under
 * it the title, who posted it, like / comment / save, the description and
 * the comments. Its owner gets a cog with Edit and Delete (an admin, just Delete).
 *
 * A view is counted once, when playback first starts — not on open, so a
 * tap in and straight back out isn't a view.
 */
export default function ProVideoScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<FeedStackParamList, 'ProVideo'>>();
  const { videoId } = route.params;
  const { data: video, isLoading, isError, refetch } = useGetProVideoQuery(videoId);

  useLayoutEffect(() => {
    navigation.setOptions({ title: video?.title ?? 'Video' });
  }, [navigation, video?.title]);

  if (!video) {
    return (
      <View style={[styles.root, styles.center]}>
        {isLoading ? <ActivityIndicator color={COLOR_WHITE} />
          : <EmptyState title={isError ? "Couldn't load this video" : 'Video not found'} actionLabel="Try again" onAction={refetch} />}
      </View>
    );
  }
  if (video.status !== 'ready' || !video.playback_id) {
    return (
      <View style={[styles.root, styles.center]}>
        <EmptyState
          title={video.status === 'processing' ? 'Still processing' : video.status === 'uploading' ? 'Still uploading' : "This video can't play"}
          message={video.status === 'processing' ? "It'll be ready to watch in a few minutes." : video.error?.message}
          actionLabel="Check again"
          onAction={refetch}
        />
      </View>
    );
  }
  // Keyed: a different video is a fresh player, not the old one retargeted.
  return <Player key={video.internal_id} video={video} />;
}

function Player({ video }: { video: ProVideo }) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width, height: screenH } = useWindowDimensions();
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const isAdmin = useAppSelector((s) => s.auth.userInfo?.accountType === 'admin');
  const mine = video.user_id === myId;
  const { data: meta } = useGetProVideoMetaQuery();
  const [countView] = useCountProVideoViewMutation();
  const [toggleBookmark] = useToggleProVideoBookmarkMutation();
  const [deleteVideo] = useDeleteProVideoMutation();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const scrollRef = useRef<any>(null);
  const commentsY = useRef(0);

  // As wide as the screen, as tall as its shape asks — but never so tall a
  // portrait video leaves no room for its title.
  const stageH = Math.min(width / aspectOf(video), screenH * 0.62);

  const player = useVideoPlayer(muxHls(video.playback_id!), (p) => {
    p.loop = false;
    p.play();
  });

  // One view per open, once it's actually playing.
  const counted = useRef(false);
  useEffect(() => {
    const sub = player.addListener('playingChange', ({ isPlaying }) => {
      if (isPlaying && !counted.current) {
        counted.current = true;
        countView(video.internal_id).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [player, countView, video.internal_id]);

  const onBookmark = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleBookmark(video.internal_id);
  };

  const onDelete = () => {
    Alert.alert('Delete this video?', "It's gone for good — for you and everyone watching.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            forgetProVideo(video.internal_id);
            await deleteVideo(video.internal_id).unwrap();
            navigation.goBack();
          } catch {
            Alert.alert("Couldn't delete it", 'Try again in a moment.');
          }
        },
      },
    ]);
  };

  const category = meta?.categories.find((c) => c.key === video.category)?.label;
  const car = [video.year, video.make, video.model].filter(Boolean).join(' ');
  const when = video.ready_at ?? video.created_at;
  const meta1 = [
    `${formatActionCount(video.views)} view${video.views === 1 ? '' : 's'}`,
    when ? formatDistanceToNow(new Date(when), { addSuffix: true }) : null,
    formatDuration(video.duration),
  ].filter(Boolean).join(' · ');

  return (
    <View style={styles.root}>
      <FormScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={[styles.stage, { height: stageH }]}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            nativeControls
            fullscreenOptions={{ enable: true }}
            allowsPictureInPicture
          />
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{video.title}</Text>
          <View style={styles.metaLine}>
            <Eye size={13} color={COLOR_GRAY_160} />
            <Text style={styles.meta}>{meta1}</Text>
          </View>
          {category || car ? (
            <View style={styles.tags}>
              {category ? <Tag label={category} /> : null}
              {car ? <Tag label={car} /> : null}
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.author}
            onPress={() => navigation.navigate('UserDetail', { userId: video.user_id, username: video.user?.username })}
            activeOpacity={0.8}
          >
            <Avatar user={video.user ?? undefined} size={36} />
            <View style={styles.authorText}>
              <Text style={styles.authorName}>{authorName(video.user)}</Text>
              {video.user?.username ? <Text style={styles.meta}>@{video.user.username}</Text> : null}
            </View>
          </TouchableOpacity>

          <View style={styles.actions}>
            <LikeButton
              documentId={video.internal_id}
              entryType={ENTRY_TYPE}
              initialLiked={video.has_liked}
              initialCount={video.like_count}
              ownerId={video.user_id}
              size={22}
              color={COLOR_WHITE}
              litColor={colors.pro}
              style={styles.actionBtn}
              // The card's counts and any refetch-free copy agree with the tap.
              onToggle={(liked) => patchProVideoCaches(store.dispatch, store.getState, video.internal_id, (v) => {
                v.has_liked = liked;
                v.like_count = Math.max(0, (v.like_count ?? 0) + (liked ? 1 : -1));
              })}
            />
            <View style={styles.actionBtn}>
              <CommentButton
                count={video.comment_count}
                documentId={video.internal_id}
                color={COLOR_WHITE}
                onPress={() => scrollRef.current?.scrollTo?.({ y: commentsY.current, animated: true })}
              />
            </View>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={onBookmark}
              accessibilityRole="button"
              accessibilityLabel={video.bookmarked ? 'Remove from saved' : 'Save'}
              accessibilityState={{ selected: video.bookmarked }}
            >
              <Bookmark size={20} color={video.bookmarked ? colors.pro : COLOR_WHITE} fill={video.bookmarked ? colors.pro : 'transparent'} />
              {video.bookmark_count > 0 ? <Text style={styles.count}>{formatActionCount(video.bookmark_count)}</Text> : null}
            </TouchableOpacity>
            {mine || isAdmin ? (
              <TouchableOpacity style={[styles.actionBtn, styles.more]} onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="Video options">
                <Settings size={19} color={COLOR_WHITE} strokeWidth={2.2} />
              </TouchableOpacity>
            ) : null}
          </View>

          {video.description ? <Text style={styles.description}>{video.description}</Text> : null}
        </View>

        {/* Bare and see-through: no rule or panel of its own, just the thread
            on the screen's background, a little way under the description. */}
        <View style={styles.comments} onLayout={(e) => { commentsY.current = e.nativeEvent.layout.y; }}>
          <InlineComments documentId={video.internal_id} entryType={ENTRY_TYPE} bare backgroundColor="transparent" />
        </View>
      </FormScrollView>

      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={mine ? 'Your video' : undefined}
        options={[
          ...(mine ? [{ label: 'Edit', Icon: Pencil, onPress: () => setEditing(true) }] : []),
          { label: 'Delete', Icon: Trash2, destructive: true, onPress: onDelete },
        ]}
      />
      <ProVideoDetailsSheet visible={editing} video={video} onClose={() => setEditing(false)} />
    </View>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: APP_BG },
  center: { alignItems: 'center', justifyContent: 'center' },
  stage: { width: '100%', backgroundColor: COLOR_BLACK },
  body: { paddingHorizontal: GUTTER + 10, paddingTop: 14, gap: 10 },
  title: { color: COLOR_WHITE, fontSize: 20, lineHeight: 26, fontFamily: FONT_INTER.bold },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { color: COLOR_GRAY_160, fontSize: 13, fontFamily: FONT_INTER.medium },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: SURFACE_MID, borderRadius: PILL_RADIUS, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { color: COLOR_WHITE, fontSize: 12, fontFamily: FONT_INTER.semibold },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  authorText: { flex: 1 },
  authorName: { color: COLOR_WHITE, fontSize: 15, fontFamily: FONT_INTER.bold },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 38,
    borderRadius: PILL_RADIUS, backgroundColor: SURFACE_MID,
  },
  more: { marginLeft: 'auto' },
  count: { color: COLOR_WHITE, fontSize: 13, fontFamily: FONT_INTER.medium },
  description: { color: 'rgba(255,255,255,0.88)', fontSize: 14.5, lineHeight: 21, marginTop: 6 },
  comments: { marginTop: 24 },
});
