import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Dimensions, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, MessageCircle, Link as LinkIcon, ExternalLink } from 'lucide-react-native';
import ReportButton from '../../components/ui/ReportButton';
import PostOwnerMenu from '../../components/social/PostOwnerMenu';
import { useNavigation } from '@react-navigation/native';
import { useGetPostQuery, useCreateCommentMutation, useGetPostCountsQuery, useGetLikeInfoQuery } from '../../api/apiService';
import { useCommentThread } from '../../hooks/useCommentThread';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import { TYPE_LABELS, CATEGORY_LABELS } from '../../components/ui/Badge';
import LikeButton from '../../components/social/LikeButton';
import CommentRow, { type CommentData } from '../../components/social/CommentRow';
import LikersSheet from '../../components/social/LikersSheet';
import PostEditSheet from '../../components/social/PostEditSheet';
import Spinner from '../../components/ui/Spinner';
import { imageUrl } from '../../utils/image';
import { colors, BADGE_COLORS, CATEGORY_BADGE_COLORS } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { FeedScreenProps, AppStackParamList } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { GalleryItem } from '../../types/api';
import { stripHtml, extractLinks, linkLabel } from '../../utils/text';
import MentionText from '../../components/ui/MentionText';
import PostTagBadges from '../../components/social/PostTagBadges';
import { tabNavProxy } from '../../navigation/navigateInTabs';
import { ss } from '../../styles/shared';

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
      style={styles.videoPlayer}
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
        {/* Dot indicators — float over the bottom of the image */}
        {gallery.length > 1 && (
          <View style={styles.dots} pointerEvents="none">
            {gallery.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PostDetailScreen({ route }: FeedScreenProps<'PostDetail'>) {
  const { postId } = route.params;
  const { userInfo } = useAppSelector((s) => s.auth);
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  /**
   * Dismiss this modal, then open the target. Deferred a frame so the pop has
   * been committed before the push — otherwise the new screen can end up
   * beneath the modal that's still animating out.
   */
  const dismissThenNavigate = (go: (nav: any) => void) => {
    navigation.goBack();
    // Route into the tab stacks so the target keeps the header and bottom nav.
    requestAnimationFrame(() => go(tabNavProxy(navigation)));
  };

  // Two related greys: the post body sits a step above the comments, so the
  // sections read as distinct without needing a hard divider.
  const bodyBg = '#181818';
  const commentsBg = '#101010';

  const { data: postData, isLoading } = useGetPostQuery(postId);
  const post = postData ? { ...postData.entry, user: postData.entry.user ?? postData.user } : undefined;
  const { rows: commentRows, comments } = useCommentThread(post?.entry_type ?? 'post', postId, { skip: !post });
  const { data: counts } = useGetPostCountsQuery(postId, { skip: !post });
  const { data: likeInfo } = useGetLikeInfoQuery(postId, { skip: !post });

  const [createComment, { isLoading: submitting }] = useCreateCommentMutation();
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(null);
  const [likersOpen, setLikersOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const hiddenIds = useAppSelector((s) => (s as any).moderation?.hiddenContentIds ?? []);

  // Auto-open the editor when deep-linked with edit=true (from the "..." menu).
  useEffect(() => {
    if ((route.params as any)?.edit) setEditOpen(true);
  }, [route.params]);

  // Navigate back if this post gets reported/hidden
  useEffect(() => {
    if (hiddenIds.includes(postId)) navigation.goBack();
  }, [hiddenIds, postId, navigation]);

  if (isLoading || !post) return <Spinner fullScreen />;

  const isOwner = userInfo?.user_id === post.user_id;
  const gallery = post.gallery ?? [];
  const displayName = post.user?.username || 'Unknown';
  const entryType = post.entry_type ?? post.type ?? 'post';
  const badgeType = post.type ?? post.entry_type ?? 'post';
  const typeBadge = BADGE_COLORS[badgeType] ?? BADGE_COLORS.default;
  const categoryBadge = post.category
    ? (CATEGORY_BADGE_COLORS[post.category] ?? CATEGORY_BADGE_COLORS.default)
    : null;

  const hasMedia = !!post.video_id || gallery.length > 0;

  // Rendered over the media when there is any, otherwise in the author row.
  const badges = (
    <View style={styles.badgeRow}>
      <View style={[styles.badge, { backgroundColor: typeBadge.bg }]}>
        <Text style={[styles.badgeText, { color: typeBadge.fg }]}>
          {TYPE_LABELS[badgeType] ?? badgeType}
        </Text>
      </View>
      {categoryBadge && (
        <View style={[styles.badge, { backgroundColor: categoryBadge.bg }]}>
          <Text style={[styles.badgeText, { color: categoryBadge.fg }]}>
            {CATEGORY_LABELS[post.category!] ?? post.category}
          </Text>
        </View>
      )}
    </View>
  );

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    const fd = new FormData();
    fd.append('document_id', post.internal_id);
    fd.append('document_type', entryType);
    fd.append('body', commentText.trim());
    if (replyingTo) fd.append('reply_to', replyingTo.commentId);
    try {
      await createComment(fd).unwrap();
      setCommentText('');
      setReplyingTo(null);
    } catch {
      Alert.alert('Error', 'Could not post comment.');
    }
  };

  return (
    // No 'bottom' edge — the comment bar owns the bottom inset so its own
    // background reaches the viewport edge instead of leaving a dead strip.
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['top']}>
      {/* Custom modal header */}
      <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={styles.modalHeaderBtn}>
          <X size={22} color={colors.fg} />
        </TouchableOpacity>
        <Text style={[styles.modalHeaderTitle, { color: colors.fg }]} numberOfLines={1}>
          {post.title || 'Post'}
        </Text>
        {isOwner ? (
          <View style={styles.modalHeaderBtn}>
            <PostOwnerMenu
              postId={postId}
              size={22}
              color={colors.fg}
              onEdit={() => setEditOpen(true)}
              onDeleted={() => navigation.goBack()}
            />
          </View>
        ) : (
          <View style={styles.modalHeaderBtn}>
            <ReportButton contentType="post" contentId={postId} size={22} />
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={90}
      >
        <FlatList
          data={commentRows}
          keyExtractor={(item: any) => item.comment.internal_id ?? item.comment._id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Title lives in the modal header, not here. */}
              {post.body && (
                <MentionText
                  text={stripHtml(post.body)}
                  style={[styles.postBody, { color: colors.muted, backgroundColor: bodyBg }]}
                />
              )}

              {hasMedia && (
                <View>
                  {post.video_id ? (
                    <StoryVideoPlayer videoId={post.video_id} />
                  ) : (
                    <GallerySwiper gallery={gallery} />
                  )}
                  {/* Type/category badges float over the media, top right. */}
                  <View style={styles.badgeOverlay} pointerEvents="none">
                    {badges}
                  </View>
                </View>
              )}

              <View style={[styles.postHeader, { backgroundColor: bodyBg }]}>
                <TouchableOpacity
                  style={styles.postHeaderUser}
                  onPress={() => post.user?.user_id && dismissThenNavigate((n) =>
                    n.navigate('UserDetail', { userId: post.user!.user_id, username: post.user!.username })
                  )}
                  activeOpacity={0.7}
                >
                  <Avatar
                    filename={post.user?.gallery?.[0]?.filename ?? post.user?.profilePicture}
                    name={displayName}
                    size={40}
                  />
                  <View style={styles.postHeaderText}>
                    <Text style={[styles.author, { color: colors.fg }]}>@{displayName}</Text>
                  </View>
                </TouchableOpacity>
                {/* With media present the badges sit over it instead. */}
                {!hasMedia && badges}
                <LikeButton
                  documentId={post.internal_id}
                  entryType={entryType}
                  initialCount={counts?.likes ?? post.like_count ?? 0}
                  initialLiked={likeInfo?.hasLiked ?? post.isLiked ?? false}
                />
              </View>

              {/* Links found in the post body → open in the external browser */}
              {extractLinks(post.body).length > 0 && (
                <View style={[styles.linkWrap, { backgroundColor: bodyBg }]}>
                  {extractLinks(post.body).map((url) => (
                    <TouchableOpacity
                      key={url}
                      style={[styles.linkBtn, { borderColor: colors.border }]}
                      onPress={() => Linking.openURL(url).catch(() => Alert.alert('Could not open link', url))}
                      activeOpacity={0.8}
                    >
                      <LinkIcon size={16} color={colors.primaryAlt} />
                      <Text style={[styles.linkBtnText, { color: colors.primaryAlt }]} numberOfLines={1}>
                        {linkLabel(url)}
                      </Text>
                      <ExternalLink size={14} color={colors.grey} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Tagged people, cars & events. Opening one closes this modal
                  first so the target replaces it instead of stacking on top. */}
              <PostTagBadges postId={post.internal_id} onNavigate={dismissThenNavigate} />

              {post.price && (
                <Text style={[styles.price, { backgroundColor: bodyBg }]}>${Number(post.price).toLocaleString()}</Text>
              )}

              {(post.type === 'listing' || post.type === 'want') && post.user && !isOwner && (
                <TouchableOpacity
                  style={[styles.messageBtn, { backgroundColor: bodyBg, borderTopColor: colors.border, borderBottomColor: colors.border }]}
                  onPress={() => navigation.navigate('ComposeMessage', {
                    userId: post.user!.user_id,
                    username: post.user!.username,
                    subject: `Re: ${post.title || 'your listing'}`,
                    initialBody: `Hi${post.user!.username ? ` @${post.user!.username}` : ''}, I'm interested in your listing "${post.title || 'your listing'}".`,
                  })}
                  activeOpacity={0.8}
                >
                  <MessageCircle size={18} color={colors.primaryAlt} />
                  <Text style={[styles.messageBtnText, { color: colors.primaryAlt }]}>
                    Message @{post.user.username} about this
                  </Text>
                </TouchableOpacity>
              )}

              {(counts?.likes ?? 0) > 0 && (
                <TouchableOpacity
                  style={[styles.likedByRow, { backgroundColor: bodyBg }]}
                  onPress={() => setLikersOpen(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.likedByText, { color: colors.muted }]}>
                    Liked by {counts!.likes} {counts!.likes === 1 ? 'person' : 'people'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* No label — the darker background is enough to mark the section. */}
              <View style={[
                styles.commentsDivider,
                { backgroundColor: commentsBg, borderTopColor: colors.border },
              ]} />
            </View>
          }
          renderItem={({ item }: { item: { comment: CommentData; isReply: boolean } }) => (
            <CommentRow
              comment={item.comment}
              currentUserId={userInfo?.user_id}
              isReply={item.isReply}
              backgroundColor={commentsBg}
              onReply={(commentId, username) => {
                setReplyingTo({ commentId, username });
                setCommentText(`@${username} `);
              }}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.noComments, { color: colors.greyDark, backgroundColor: commentsBg }]}>
              No comments yet. Be first!
            </Text>
          }
          style={{ backgroundColor: commentsBg }}
          contentContainerStyle={styles.list}
        />

        <View style={{
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          // Clear the home indicator / nav bar without double-counting the
          // safe area, which the SafeAreaView no longer applies.
          paddingBottom: Platform.OS === 'android' ? 48 : Math.max(insets.bottom, 12),
        }}>
          {replyingTo && (
            <View style={[styles.replyBanner, { backgroundColor: colors.segment, borderBottomColor: colors.border }]}>
              <Text style={[styles.replyBannerText, { color: colors.grey }]}>
                Replying to <Text style={{ fontWeight: '700', color: colors.fg }}>@{replyingTo.username}</Text>
              </Text>
              <TouchableOpacity onPress={() => { setReplyingTo(null); setCommentText(''); }} hitSlop={8}>
                <X size={16} color={colors.grey} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <Avatar filename={userInfo?.gallery?.[0]?.filename} name={userInfo?.username ?? '?'} size={32} />
            <TextInput
              style={[ss.chatInput, { borderColor: colors.border, color: colors.fg }]}
              value={commentText}
              onChangeText={setCommentText}
              placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Write a comment...'}
              placeholderTextColor={colors.grey}
              multiline
              autoFocus={!!replyingTo}
            />
            <TouchableOpacity
              onPress={handleSubmitComment}
              disabled={submitting || !commentText.trim()}
              style={[styles.sendBtn, (!commentText.trim() || submitting) && styles.sendBtnDisabled]}
            >
              <Text style={styles.sendText}>Post</Text>
            </TouchableOpacity>
          </View>
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
  flex:             { flex: 1 },
  modalHeader:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingVertical: 18, borderBottomWidth: 1,
  },
  modalHeaderBtn:   { width: 44, alignItems: 'center' },
  modalHeaderTitle: { fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
  list: { paddingBottom: 100 },
  linkWrap:        { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  linkBtn:         {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderRadius: 10,
  },
  linkBtnText:     { flex: 1, fontSize: 14, fontWeight: '700' },
  postHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 12,
  },
  postHeaderUser:  { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  postHeaderText:  { flex: 1 },
  badgeOverlay: {
    position: 'absolute', top: 10, right: 10,
    alignItems: 'flex-end',
  },
  badgeRow:        { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  badge:           { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 5 },
  badgeText:       { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  author:          { fontSize: 15, fontWeight: '700' },
  username:        { fontSize: 12 },
  postBody:        { fontSize: 15, lineHeight: 22, paddingHorizontal: 16, paddingVertical: 12 },
  singleImage:     { width: '100%', height: 300 },
  videoPlayer:     { width: '100%', aspectRatio: 4 / 5, backgroundColor: '#000' },
  dots: {
    position: 'absolute', left: 0, right: 0, bottom: 12,
    flexDirection: 'row', justifyContent: 'center', gap: 7,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotActive: {
    backgroundColor: '#FFFFFF',
    // Keeps the dots legible over a light photo.
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4, shadowRadius: 2,
  },
  dotInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4, shadowRadius: 2,
  },
  price:           { fontSize: 24, fontWeight: '800', color: colors.primaryAlt, paddingHorizontal: 16, paddingTop: 12 },
  messageBtn:      {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderBottomWidth: 1, marginTop: 4,
  },
  messageBtnText:  { fontSize: 15, fontWeight: '700' },
  likedByRow:      { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  likedByText:     { fontSize: 13 },
  // Empty spacer that starts the comments section — its background and top
  // border are what set it apart now that the label is gone.
  commentsDivider: {
    height: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  noComments:      { textAlign: 'center', padding: 24, fontSize: 14, fontStyle: 'italic' },
  replyBanner:     {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 1,
  },
  replyBannerText: { fontSize: 13 },
  inputRow:        {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingVertical: 14,
    gap: 10,
  },
  sendBtn:         { backgroundColor: colors.primaryAlt, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  sendBtnDisabled: { opacity: 0.4 },
  sendText:        { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
