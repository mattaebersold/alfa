import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Settings } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useGetPostQuery, useGetCommentsQuery, useCreateCommentMutation, useGetPostCountsQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import Badge, { TYPE_LABELS, CATEGORY_LABELS } from '../../components/ui/Badge';
import LikeButton from '../../components/social/LikeButton';
import CommentRow from '../../components/social/CommentRow';
import LikersSheet from '../../components/social/LikersSheet';
import PostEditSheet from '../../components/social/PostEditSheet';
import Spinner from '../../components/ui/Spinner';
import { imageUrl } from '../../utils/image';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { FeedScreenProps } from '../../navigation/types';
import type { GalleryItem } from '../../types/api';
import { stripHtml } from '../../utils/text';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ── Story video ───────────────────────────────────────────────────────────────

function StoryVideoPlayer({ videoId }: { videoId: string }) {
  const player = useVideoPlayer(`https://stream.mux.com/${videoId}.m3u8`, (p) => {
    p.loop = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={styles.singleImage}
      contentFit="contain"
      nativeControls
    />
  );
}

// ── Gallery swiper ────────────────────────────────────────────────────────────

function GallerySwiper({ gallery }: { gallery: GalleryItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [ratios, setRatios] = useState<Record<number, number>>({});

  if (gallery.length === 1) {
    const ratio = ratios[0] ?? 16 / 9;
    return (
      <Image
        source={{ uri: imageUrl(gallery[0].filename)! }}
        style={{ width: '100%', aspectRatio: ratio }}
        contentFit="cover"
        onLoad={(e) => setRatios({ 0: e.source.width / e.source.height })}
      />
    );
  }

  const currentRatio = ratios[activeIndex] ?? 16 / 9;
  const containerHeight = SCREEN_WIDTH / currentRatio;

  return (
    <View>
      <View style={{ height: containerHeight, overflow: 'hidden' }}>
        <FlatList
          data={gallery}
          keyExtractor={(item, i) => item.filename ?? String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setActiveIndex(idx);
          }}
          renderItem={({ item, index }) => {
            const ratio = ratios[index] ?? currentRatio;
            return (
              <View style={{ width: SCREEN_WIDTH, height: containerHeight, justifyContent: 'center' }}>
                <Image
                  source={{ uri: imageUrl(item.filename)! }}
                  style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH / ratio }}
                  contentFit="cover"
                  onLoad={(e) => {
                    const r = e.source.width / e.source.height;
                    setRatios((prev) => ({ ...prev, [index]: r }));
                  }}
                />
              </View>
            );
          }}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
        />
      </View>
      {/* Dot indicators */}
      <View style={styles.dots}>
        {gallery.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
          />
        ))}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PostDetailScreen({ route }: FeedScreenProps<'PostDetail'>) {
  const { postId } = route.params;
  const { userInfo } = useAppSelector((s) => s.auth);
  const colors = useColors();
  const navigation = useNavigation();

  const { data: postData, isLoading } = useGetPostQuery(postId);
  const post = postData ? { ...postData.entry, user: postData.entry.user ?? postData.user } : undefined;
  const { data: commentsData } = useGetCommentsQuery(
    { type: post?.entry_type ?? 'post', id: postId, limit: 50 },
    { skip: !post }
  );
  const comments = commentsData?.entries ?? [];
  const { data: counts } = useGetPostCountsQuery(postId, { skip: !post });

  const [createComment, { isLoading: submitting }] = useCreateCommentMutation();
  const [commentText, setCommentText] = useState('');
  const [likersOpen, setLikersOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading || !post) return <Spinner fullScreen />;

  const isOwner = userInfo?.user_id === post.user_id;
  const isStory = post.type === 'story';
  const gallery = post.gallery ?? [];
  const displayName = post.user
    ? `${post.user.firstName} ${post.user.lastName}`.trim() || post.user.username
    : 'Unknown';
  const entryType = post.entry_type ?? post.type ?? 'post';

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    const fd = new FormData();
    fd.append('document_id', post.internal_id);
    fd.append('document_entry_type', entryType);
    fd.append('body', commentText.trim());
    try {
      await createComment(fd).unwrap();
      setCommentText('');
    } catch {
      Alert.alert('Error', 'Could not post comment.');
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['top', 'bottom']}>
      {/* Custom modal header */}
      <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={styles.modalHeaderBtn}>
          <X size={22} color={colors.fg} />
        </TouchableOpacity>
        <Text style={[styles.modalHeaderTitle, { color: colors.fg }]}>Post</Text>
        {isOwner ? (
          <TouchableOpacity onPress={() => setEditOpen(true)} hitSlop={8} style={styles.modalHeaderBtn}>
            <Settings size={22} color={colors.fg} />
          </TouchableOpacity>
        ) : (
          <View style={styles.modalHeaderBtn} />
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={90}
      >
        <FlatList
          data={comments}
          keyExtractor={(item: any) => item.internal_id ?? item._id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <View style={[styles.postHeader, { backgroundColor: colors.card }]}>
                <TouchableOpacity
                  style={styles.postHeaderUser}
                  onPress={() => post.user?.user_id && (navigation as any).navigate('UserDetail', { userId: post.user.user_id, username: post.user.username })}
                  activeOpacity={0.7}
                >
                  <Avatar
                    filename={post.user?.gallery?.[0]?.filename ?? post.user?.profilePicture}
                    name={displayName}
                    size={40}
                  />
                  <View style={styles.postHeaderText}>
                    <Text style={[styles.author, { color: colors.fg }]}>{displayName}</Text>
                    {post.user?.username && (
                      <Text style={[styles.username, { color: colors.grey }]}>@{post.user.username}</Text>
                    )}
                  </View>
                </TouchableOpacity>
                <View style={styles.badgeRow}>
                  <Badge variant={entryType} label={TYPE_LABELS[entryType] ?? entryType} />
                  {post.category && (
                    <Badge
                      variant={post.category}
                      label={CATEGORY_LABELS[post.category] ?? post.category}
                    />
                  )}
                </View>
              </View>

              {post.title && <Text style={[styles.postTitle, { color: colors.fg, backgroundColor: colors.card }]}>{post.title}</Text>}
              {post.body && (
                <Text style={[styles.postBody, { color: colors.muted, backgroundColor: colors.card }]}>{stripHtml(post.body)}</Text>
              )}

              {isStory && post.video_id ? (
                <StoryVideoPlayer videoId={post.video_id} />
              ) : gallery.length > 0 ? (
                <GallerySwiper gallery={gallery} />
              ) : null}

              {post.price && (
                <Text style={[styles.price, { backgroundColor: colors.card }]}>${Number(post.price).toLocaleString()}</Text>
              )}

              {(counts?.likes ?? 0) > 0 && (
                <TouchableOpacity
                  style={[styles.likedByRow, { backgroundColor: colors.card }]}
                  onPress={() => setLikersOpen(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.likedByText, { color: colors.muted }]}>
                    Liked by {counts!.likes} {counts!.likes === 1 ? 'person' : 'people'}
                  </Text>
                </TouchableOpacity>
              )}

              <View style={[styles.likeRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <LikeButton
                  documentId={post.internal_id}
                  entryType={entryType}
                  initialCount={counts?.likes ?? post.like_count ?? 0}
                  initialLiked={post.isLiked ?? false}
                />
              </View>

              <View style={styles.commentsDivider}>
                <Text style={[styles.commentsLabel, { color: colors.grey }]}>
                  Comments {comments.length > 0 ? `(${comments.length})` : ''}
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }: { item: any }) => (
            <CommentRow comment={item} />
          )}
          ListEmptyComponent={
            <Text style={[styles.noComments, { color: colors.grey }]}>No comments yet. Be first!</Text>
          }
          contentContainerStyle={styles.list}
        />

        <View style={[styles.inputRow, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Avatar filename={userInfo?.gallery?.[0]?.filename} name={userInfo?.firstName ?? '?'} size={32} />
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.fg }]}
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Write a comment..."
            placeholderTextColor={colors.grey}
            multiline
          />
          <TouchableOpacity
            onPress={handleSubmitComment}
            disabled={submitting || !commentText.trim()}
            style={[styles.sendBtn, (!commentText.trim() || submitting) && styles.sendBtnDisabled]}
          >
            <Text style={styles.sendText}>Post</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <LikersSheet
        entryId={postId}
        visible={likersOpen}
        onClose={() => setLikersOpen(false)}
      />
      <PostEditSheet
        post={post}
        visible={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1 },
  flex:             { flex: 1 },
  modalHeader:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingVertical: 10, borderBottomWidth: 1,
  },
  modalHeaderBtn:   { width: 44, alignItems: 'center' },
  modalHeaderTitle: { fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
  list: { paddingBottom: 16 },
  postHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 12,
  },
  postHeaderUser:  { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  postHeaderText:  { flex: 1 },
  badgeRow:        { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  author:          { fontSize: 15, fontWeight: '700' },
  username:        { fontSize: 12 },
  postTitle:       { fontSize: 18, fontWeight: '800', paddingHorizontal: 16, paddingTop: 12 },
  postBody:        { fontSize: 15, lineHeight: 22, paddingHorizontal: 16, paddingVertical: 12 },
  singleImage:     { width: '100%', height: 300 },
  dots:            { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  dot:             { width: 6, height: 6, borderRadius: 3 },
  dotActive:       { backgroundColor: Colors.brg },
  dotInactive:     { backgroundColor: 'rgba(0,0,0,0.2)' },
  price:           { fontSize: 24, fontWeight: '800', color: Colors.brg, paddingHorizontal: 16, paddingTop: 12 },
  likedByRow:      { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  likedByText:     { fontSize: 13 },
  likeRow:         { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  commentsDivider: { paddingHorizontal: 16, paddingVertical: 12 },
  commentsLabel:   { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  noComments:      { textAlign: 'center', padding: 24, fontSize: 14 },
  inputRow:        {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, gap: 10,
  },
  input:           {
    flex: 1, borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, maxHeight: 100,
  },
  sendBtn:         { backgroundColor: Colors.brg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  sendBtnDisabled: { opacity: 0.4 },
  sendText:        { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
