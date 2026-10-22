import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet, Alert, Keyboard, Linking,
} from 'react-native';
import { Text } from '@ors/kit';
import { X, MessageCircle, Link as LinkIcon, ExternalLink, ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useGetPostQuery, useCreateCommentMutation } from '../../api/apiService';
import { useCommentThread, type CommentRowItem } from '../../hooks/useCommentThread';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import CommentRow, { COMMENT_SURFACE } from '../../components/social/CommentRow';
import Composer, { type ComposerHandle } from '../../components/social/Composer';
import { useComposerPhotos } from '../../hooks/useComposerPhotos';
import PostEditSheet from '../../components/social/PostEditSheet';
import Spinner from '../../components/ui/Spinner';
import SharedModal, { PANE_GRABBER_H } from '../../components/ui/SharedModal';
import FeedItemCard from '../../components/cards/FeedItemCard';
import { useColors } from '../../hooks/useColors';
import type { FeedScreenProps, AppStackParamList } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { extractLinks, linkLabel } from '../../utils/text';
import { tabNavProxy } from '../../navigation/navigateInTabs';
import { useRefreshControl } from '../../hooks/useRefreshControl';
import UserSummaryModal from '../../components/members/UserSummaryModal';
import { type SummaryOrigin } from '../../components/ui/SummaryModal';
import Odometer from '../../components/ui/Odometer';
import { COMMON_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

// ── Screen ────────────────────────────────────────────────────────────────────

/**
 * One post, opened over whatever you were on — from the feed, a profile, a
 * notification.
 *
 * The app's pane (SharedModal), with its grabber: drag it down or tap it to
 * close, like every other pane. Inside, the post is the home feed's own card —
 * the same header, gallery and page dots, poll, badges and likes — given its
 * whole text, and under it what only the detail carries: the post's links,
 * the odometer, a listing's "message about this", then the comments and the
 * box to write one.
 */
export default function PostDetailScreen({ route }: FeedScreenProps<'PostDetail'>) {
  const { postId } = route.params;
  const { userInfo } = useAppSelector((s) => s.auth);
  const colors = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  /**
   * The pane's own open state. Closing runs its slide down, and the route is
   * popped once that has finished (`onDismissed`) — then anything waiting to
   * happen next, like opening a tag's page in its place.
   */
  const [open, setOpen] = useState(true);
  const after = useRef<(() => void) | null>(null);
  const close = useCallback((then?: () => void) => {
    after.current = then ?? null;
    setOpen(false);
  }, []);
  const onDismissed = useCallback(() => {
    navigation.goBack();
    const then = after.current;
    after.current = null;
    if (then) requestAnimationFrame(then);
  }, [navigation]);

  /** Close the pane, then open the target in the tabs, where it keeps its header. */
  const dismissThenNavigate = (go: (nav: any) => void) => {
    close(() => go(tabNavProxy(navigation)));
  };

  const surfaceBg = COMMENT_SURFACE;

  const { data: postData, isLoading, refetch } = useGetPostQuery(postId);
  const refreshControl = useRefreshControl(refetch);
  const post = postData ? { ...postData.entry, user: postData.entry.user ?? postData.user } : undefined;
  const { rows: commentRows } = useCommentThread(post?.entry_type ?? 'post', postId, { skip: !post });

  const [createComment, { isLoading: submitting }] = useCreateCommentMutation();
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(null);
  const photos = useComposerPhotos();
  // Tapping Reply on a comment opens the composer straight away.
  const composerRef = useRef<ComposerHandle>(null);
  // Whose summary is open, and the row it grew out of.
  const [userSummary, setUserSummary] = useState<{ userId: string; origin: SummaryOrigin | null } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const hiddenIds = useAppSelector((s) => (s as any).moderation?.hiddenContentIds ?? []);

  // Auto-open the editor when deep-linked with edit=true (from the "..." menu).
  useEffect(() => {
    if ((route.params as any)?.edit) setEditOpen(true);
  }, [route.params]);

  // Close if this post gets reported/hidden.
  useEffect(() => {
    if (hiddenIds.includes(postId)) close();
  }, [hiddenIds, postId, close]);

  const isOwner = !!post && userInfo?.user_id === post.user_id;
  /**
   * What comments on this post are filed under — `entry_type` only, never
   * `type`: a diecast post's comments are written and read under "post".
   */
  const entryType = post?.entry_type ?? 'post';
  const links = post ? extractLinks(post.body) : [];

  const handleSubmitComment = async () => {
    if (!post) return false;
    const fd = new FormData();
    fd.append('document_id', post.internal_id);
    fd.append('document_type', entryType);
    fd.append('body', commentText.trim());
    photos.appendTo(fd);
    if (replyingTo) fd.append('reply_to', replyingTo.commentId);
    try {
      await createComment(fd).unwrap();
      setCommentText('');
      setReplyingTo(null);
      photos.clear();
      Keyboard.dismiss();
    } catch {
      Alert.alert('Error', 'Could not post comment.');
      // Keeps the composer open with the words still in it.
      return false;
    }
  };

  return (
    <SharedModal
      visible={open}
      onClose={() => close()}
      onDismissed={onDismissed}
      // Just the grabber: the card's own header carries the author, the menu
      // and the title.
      hideHeader
      fullHeight
      surface={surfaceBg}
    >
      {isLoading || !post ? (
        <View style={styles.loading}><Spinner /></View>
      ) : (
      <View style={styles.flex}>
        <FlatList
          refreshControl={refreshControl}
          data={commentRows}
          keyExtractor={(item: any) => item.comment.internal_id ?? item.comment._id}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              {/* The post, as the home feed draws it — its whole text, and no
                  card of its own: the pane is the card. */}
              <FeedItemCard
                post={post}
                bare
                fullText
                visible
                onEdit={() => setEditOpen(true)}
                onDeleted={() => close()}
              />

              {/* Links found in the post body → open in the external browser */}
              {links.length > 0 && (
                <View style={[styles.card, styles.linkWrap, { backgroundColor: surfaceBg }]}>
                  {links.map((url) => (
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
                      <ExternalLink size={15} color={colors.primaryAlt} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* The number on the clock, drawn as the clock. Detail only — on
                  a feed card it would be a second thing competing with the
                  photo. */}
              {post.mileage ? (
                <View style={[styles.card, styles.mileageRow, { backgroundColor: surfaceBg }]}>
                  <Odometer value={post.mileage} />
                </View>
              ) : null}

              {(post.type === 'listing' || post.type === 'want') && post.user && !isOwner && (
                <TouchableOpacity
                  style={[styles.card, styles.actionRow, { backgroundColor: surfaceBg, borderColor: colors.primaryAlt }]}
                  onPress={() => dismissThenNavigate((n) => n.navigate('ComposeMessage', {
                    userId: post.user!.user_id,
                    username: post.user!.username,
                    subject: `Re: ${post.title || 'your listing'}`,
                    initialBody: `Hi${post.user!.username ? ` @${post.user!.username}` : ''}, I'm interested in your listing "${post.title || 'your listing'}".`,
                  }))}
                  activeOpacity={0.8}
                >
                  <MessageCircle size={18} color={colors.primaryAlt} />
                  <Text style={[styles.actionRowText, { color: colors.primaryAlt }]}>
                    Message @{post.user.username} about this
                  </Text>
                  <ChevronRight size={16} color={colors.primaryAlt} />
                </TouchableOpacity>
              )}

              {/* No label — the rule is enough to start the comments. */}
              <View style={[styles.commentsDivider, { borderTopColor: colors.border }]} />
            </View>
          }
          renderItem={({ item }: { item: CommentRowItem }) => (
            <CommentRow
              comment={item.comment}
              currentUserId={userInfo?.user_id}
              isReply={item.isReply}
              isThreadStart={item.isThreadStart}
              isThreadEnd={item.isThreadEnd}
              threadId={item.threadId}
              onOpenUser={(userId, origin) => setUserSummary({ userId, origin })}
              backgroundColor={surfaceBg}
              onReply={(commentId, username) => {
                setReplyingTo({ commentId, username });
                setCommentText(`@${username} `);
                composerRef.current?.open();
              }}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.noComments, { color: colors.greyDark }]}>
              No comments yet. Be first!
            </Text>
          }
          style={styles.flex}
          contentContainerStyle={styles.list}
        />

        {/* No fill and no rule of its own: it's the same surface as the
            comments it sits under, and the field's own border is what marks
            where you type. The pane clears the home indicator beneath it. */}
        <Composer
          ref={composerRef}
          value={commentText}
          onChangeText={setCommentText}
          placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Write a comment...'}
          photos={photos}
          onSend={handleSubmitComment}
          sending={submitting}
          sendLabel="Post"
          tone={{ surface: surfaceBg, field: surfaceBg, border: colors.border, text: colors.fg, accent: colors.primaryAlt }}
          barStyle={{ paddingHorizontal: 4, paddingTop: 4 }}
          bottomInset={0}
          leading={<Avatar user={userInfo} size={32} />}
          banner={replyingTo ? (
            <View style={[styles.replyBanner, { backgroundColor: surfaceBg, borderBottomColor: colors.border }]}>
              <Text style={[styles.replyBannerText, { color: colors.grey }]}>
                Replying to <Text style={{ fontWeight: '700', color: colors.fg }}>@{replyingTo.username}</Text>
              </Text>
              <TouchableOpacity
                onPress={() => { setReplyingTo(null); setCommentText(''); }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Stop replying"
              >
                <X size={16} color={colors.grey} />
              </TouchableOpacity>
            </View>
          ) : null}
        />

        <PostEditSheet
          post={post}
          visible={editOpen}
          onClose={() => setEditOpen(false)}
        />
        <UserSummaryModal
          userId={userSummary?.userId ?? null}
          origin={userSummary?.origin}
          onClose={() => setUserSummary(null)}
        />
      </View>
      )}
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  flex:    { flex: 1 },
  loading: { height: 300, alignItems: 'center', justifyContent: 'center' },
  // Starts clear of the grabber floating over the top — see PANE_GRABBER_H.
  list:    { paddingTop: PANE_GRABBER_H, paddingBottom: 24 },
  /**
   * The one card treatment the detail-only sections wear: inset from the
   * edges with a gap above, so they're set apart by the ground showing
   * through rather than by another shade of grey.
   */
  card: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: COMMON_RADIUS,
    overflow: 'hidden',
  },
  /**
   * Anything you can press: a bordered row with an icon in front and a
   * chevron behind, so it can't be mistaken for the static cards above it.
   */
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1,
  },
  actionRowText:   { flex: 1, fontSize: 15, fontFamily: FONT_INTER.bold },
  linkWrap:        { padding: 12, gap: 8 },
  linkBtn:         {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderRadius: COMMON_RADIUS,
  },
  linkBtnText:     { flex: 1, fontSize: 14, fontFamily: FONT_INTER.bold },
  mileageRow:      { padding: 14 },
  // Starts the comments: a rule, and room under it.
  commentsDivider: {
    height: 12, marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  noComments:      { textAlign: 'center', padding: 24, fontSize: 14, fontStyle: 'italic' },
  replyBanner:     {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 1,
  },
  replyBannerText: { fontSize: 13 },
});
