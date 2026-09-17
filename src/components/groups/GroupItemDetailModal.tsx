import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, Dimensions, ActivityIndicator,
  TouchableOpacity, Alert, Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import { ExternalLink, Pencil, Trash2, ChevronRight } from 'lucide-react-native';
import { Linking } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import {
  useCreateCommentMutation,
  useDeleteGroupDiscussionPostMutation,
  useDeleteGroupResourceMutation,
} from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import GroupVoteButtons from './GroupVoteButtons';
import { useCommentThread } from '../../hooks/useCommentThread';
import { useAppSelector } from '../../store/store';
import Avatar from '../ui/Avatar';
import MentionInput from '../ui/MentionInput';
import ImageLightbox from '../ui/ImageLightbox';
import CommentRow, { type CommentData } from '../social/CommentRow';
import SharedModal from '../ui/SharedModal';
import SharedButton from '../ui/SharedButton';
import GroupCreateSheet from './GroupCreateSheet';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import { ss } from '../../styles/shared';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';

const SCREEN_WIDTH = Dimensions.get('window').width;

type Kind = 'news' | 'discussion' | 'resource';
const ENTRY_TYPE: Record<Kind, string> = {
  news: 'groupnews',
  discussion: 'groupdiscussion',
  resource: 'groupresource',
};

function youtubeId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

interface Props {
  item: any | null;
  kind: Kind | null;
  categoryLabel?: string | null;
  /**
   * The section's category list, offered again when the author edits. Without
   * it the edit form keeps the item's category and hides the picker.
   */
  categories?: { key: string; label: string }[];
  groupTitle?: string;
  visible: boolean;
  onClose: () => void;
  /**
   * "View in group". Opt-in, and only supplied from the home feed.
   *
   * Opened from inside the group this button would point at the screen it's
   * already on; opened from the feed it's the whole reason the summary is a
   * summary — read it here, go there if it's worth it.
   */
  onViewMore?: () => void;
}

export default function GroupItemDetailModal({
  item, kind, categoryLabel, categories = [], groupTitle, visible, onClose, onViewMore,
}: Props) {
  const { userInfo } = useAppSelector((s) => s.auth);
  const colors = useColors();
  const [deleteDiscussion, { isLoading: deletingDiscussion }] = useDeleteGroupDiscussionPostMutation();
  const [deleteResource, { isLoading: deletingResource }] = useDeleteGroupResourceMutation();
  const deleting = deletingDiscussion || deletingResource;
  const [editOpen, setEditOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(null);
  // Which photo the full-screen viewer is on, if it's open.
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  const entryType = kind ? ENTRY_TYPE[kind] : '';
  const id = item?.internal_id ?? '';

  const { rows, comments, isFetching } = useCommentThread(entryType, id, {
    skip: !visible || !id || !entryType,
  });
  const [createComment, { isLoading: submitting }] = useCreateCommentMutation();

  const handleSubmit = async () => {
    const body = commentText.trim();
    if (!body || !id) return;
    const fd = new FormData();
    fd.append('document_id', id);
    fd.append('document_type', entryType);
    fd.append('body', body);
    if (replyingTo) fd.append('reply_to', replyingTo.commentId);
    if (mentionedIds.length) fd.append('mentioned_users', mentionedIds.join(','));
    try {
      await createComment(fd as any).unwrap();
      setCommentText('');
      setMentionedIds([]);
      setReplyingTo(null);
      // The composer is inline here, so there's no pane to close — just get
      // the keyboard out of the way of the comment you just posted.
      Keyboard.dismiss();
    } catch {
      // no-op
    }
  };

  if (!item || !kind) {
    return <SharedModal visible={visible} onClose={onClose} title="" >{null as any}</SharedModal>;
  }

  const d = item;
  const gallery = d.gallery ?? [];
  const zoomUrls = (gallery.length > 0
    ? gallery.map((g: any) => imageUrl(g.filename))
    : [d.image ? imageUrl(d.image) : null]
  ).filter((u: string | null): u is string => !!u);
  const hero = firstGalleryUrl(gallery) ?? (d.image ? imageUrl(d.image) : null);
  const timeAgo = d.created_at ? formatDistanceToNow(new Date(d.created_at), { addSuffix: true }) : '';
  const kindLabel = kind === 'news' ? 'News' : kind === 'resource' ? 'Resource' : 'Discussion';
  const ytId = kind === 'resource' ? youtubeId(d.url) : null;

  // Authors manage their own discussion posts and resources. The server also
  // lets group admins in, but only the author is offered the controls here.
  const isAuthor = !!userInfo?.user_id && (d.user_id ?? d.user?.user_id) === userInfo.user_id;
  const canManage = isAuthor && (kind === 'discussion' || kind === 'resource');

  const confirmDelete = () => {
    const noun = kind === 'resource' ? 'resource' : 'discussion post';
    Alert.alert(`Delete this ${noun}?`, "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const args = { internal_id: d.internal_id, group_id: d.group_id };
          try {
            await (kind === 'resource' ? deleteResource(args) : deleteDiscussion(args)).unwrap();
            onClose();
          } catch {
            Alert.alert('Could not delete', 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SharedModal visible={visible} onClose={onClose} title={kindLabel}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Media */}
        {ytId ? (
          <View style={styles.ytWrap}>
            <WebView source={{ uri: `https://www.youtube.com/embed/${ytId}` }} style={styles.ytPlayer} allowsFullscreenVideo javaScriptEnabled />
          </View>
        ) : gallery.length > 1 ? (
          <FlatList
            data={gallery}
            keyExtractor={(g: any, i) => g.filename ?? String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            renderItem={({ item: g, index }: any) => (
              // Tap opens it full-screen, where it can be pinched into.
              <TouchableOpacity activeOpacity={0.95} onPress={() => setZoomIndex(index)}>
                <Image source={{ uri: imageUrl(g.filename) ?? undefined }} style={styles.galleryImage} contentFit="cover" />
              </TouchableOpacity>
            )}
          />
        ) : hero ? (
          <TouchableOpacity activeOpacity={0.95} onPress={() => setZoomIndex(0)}>
            <Image source={{ uri: hero }} style={styles.hero} contentFit="cover" />
          </TouchableOpacity>
        ) : null}

        <View style={styles.body}>
          {categoryLabel ? (
            <View style={styles.catChip}>
              <Text style={styles.catChipText}>{categoryLabel}</Text>
            </View>
          ) : null}
          <Text style={styles.title}>{d.title}</Text>
          <View style={styles.meta}>
            <Avatar user={d.user} size={26} />
            <Text style={styles.metaText} numberOfLines={1}>@{d.user?.username} · {timeAgo}</Text>
            {canManage && (
              <View style={styles.ownerActions}>
                <TouchableOpacity
                  style={[styles.ownerBtn, { borderColor: colors.borderDark }]}
                  onPress={() => setEditOpen(true)}
                  disabled={deleting}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${kindLabel.toLowerCase()}`}
                >
                  <Pencil size={13} color={colors.fg} />
                  <Text style={[styles.ownerBtnText, { color: colors.fg }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.ownerBtn, { borderColor: colors.borderDark }, deleting && { opacity: 0.4 }]}
                  onPress={confirmDelete}
                  disabled={deleting}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${kindLabel.toLowerCase()}`}
                >
                  <Trash2 size={13} color={colors.red} />
                  <Text style={[styles.ownerBtnText, { color: colors.red }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {d.body ? <Text style={styles.text}>{stripHtml(d.body)}</Text> : null}

          {/* Voting. Lives here rather than on the list row — it's a response to
              having read the thing, and the row is a link, not a control.
              All three kinds vote now; resources and news showed nothing at
              all before, though the endpoints existed. */}
          <View style={styles.voteRow}>
            <GroupVoteButtons
              kind={kind}
              internal_id={d.internal_id}
              group_id={d.group_id}
              upvotes={d.upvotes}
              downvotes={d.downvotes}
              votes={d.votes}
              size={17}
            />
          </View>

          {/* Resource link */}
          {kind === 'resource' && d.url && !ytId ? (
            <SharedButton label="Open Link" Icon={ExternalLink} onPress={() => Linking.openURL(d.url)} full style={{ marginTop: 16 }} />
          ) : null}

          {/* Comments */}
          <Text style={styles.commentsHeading}>Comments{comments.length ? ` (${comments.length})` : ''}</Text>

          {replyingTo && (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText}>
                Replying to <Text style={{ fontWeight: '700', color: '#ECECEC' }}>@{replyingTo.username}</Text>
              </Text>
              <TouchableOpacity onPress={() => { setReplyingTo(null); setCommentText(''); }} hitSlop={8}>
                <Text style={styles.replyCancel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputRow}>
            <MentionInput
              containerStyle={{ flex: 1 }}
              style={[ss.chatInput, { borderColor: '#2A2A2A', color: '#ECECEC', maxHeight: 120 }]}
              value={commentText}
              onChangeText={(t, ids) => { setCommentText(t); setMentionedIds(ids); }}
              placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Write a comment...'}
              placeholderTextColor="#8D8D8D"
              multiline
            />
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting || !commentText.trim()}
              style={[styles.postBtn, (!commentText.trim() || submitting) && { opacity: 0.4 }]}
            >
              <Text style={styles.postBtnText}>Post</Text>
            </TouchableOpacity>
          </View>

          {isFetching && comments.length === 0 ? (
            <ActivityIndicator size="small" color="#8D8D8D" style={{ marginTop: 16 }} />
          ) : rows.length === 0 ? (
            <Text style={styles.empty}>No comments yet. Be the first!</Text>
          ) : (
            rows.map(({ comment: cm, isReply, isThreadStart, isThreadEnd, threadId }) => (
              <CommentRow
                key={(cm as any).internal_id ?? (cm as any)._id}
                comment={cm}
                currentUserId={userInfo?.user_id}
                isReply={isReply}
                isThreadStart={isThreadStart}
                isThreadEnd={isThreadEnd}
                threadId={threadId}
                onReply={(commentId, username) => {
                  setReplyingTo({ commentId, username });
                  setCommentText(`@${username} `);
                }}
              />
            ))
          )}
        </View>
      </ScrollView>

      {onViewMore && (
        /* Below the scroller, not in it: it's the way out of this summary, and
           somewhere in the middle of a long discussion is not where you look
           for one. Closing first — the navigation happens on the other side of
           the dismissal, because iOS won't present over a modal that is still
           going away. */
        <TouchableOpacity
          style={[styles.viewMore, { borderTopColor: colors.border }]}
          onPress={() => { onClose(); onViewMore(); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.viewMoreText, { color: colors.primaryAlt }]}>View in group</Text>
          <ChevronRight size={15} color={colors.primaryAlt} />
        </TouchableOpacity>
      )}

      <ImageLightbox
        images={zoomUrls}
        initialIndex={zoomIndex ?? 0}
        visible={zoomIndex !== null}
        onClose={() => setZoomIndex(null)}
      />

      {/* Inside this modal's tree, so it presents over it rather than needing
          the detail closed first. */}
      {canManage && (
        <GroupCreateSheet
          kind={kind === 'resource' ? 'resources' : 'discussion'}
          groupId={d.group_id}
          groupTitle={groupTitle}
          categories={categories}
          editing={{
            internal_id: d.internal_id,
            title: d.title,
            // Entries written on the web can carry markup; ones from here are
            // plain text, whose line breaks stripHtml would flatten.
            body: /<[a-z][^>]*>/i.test(d.body ?? '') ? stripHtml(d.body) : d.body,
            url: d.url,
            category: d.category,
          }}
          visible={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  viewMore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 15, borderTopWidth: 1,
  },
  viewMoreText: { fontSize: 15, fontWeight: '800' },

  scroll:  { paddingBottom: 40 },
  ytWrap:  { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  ytPlayer:{ flex: 1, backgroundColor: '#000' },
  hero:    { width: '100%', aspectRatio: 16 / 9 },
  galleryImage: { width: SCREEN_WIDTH, aspectRatio: 16 / 9 },
  body:    { padding: 16 },
  catChip: { alignSelf: 'flex-start', backgroundColor: '#2A2A2A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: PILL_RADIUS, marginBottom: 8 },
  catChipText: { color: '#B4B4B4', fontSize: 10, fontWeight: '800' },
  title:   { fontSize: 20, fontWeight: '800', color: '#FFFFFF', lineHeight: 26, marginBottom: 12 },
  meta:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  metaText:{ fontSize: 12, color: '#B4B4B4', flexShrink: 1 },
  ownerActions: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  ownerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  ownerBtnText: { fontSize: 12, fontWeight: '700' },
  voteRow:  { flexDirection: 'row', gap: 10, marginTop: 18 },
  text:    { fontSize: 15, lineHeight: 24, color: '#ECECEC' },
  commentsHeading: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginTop: 24, marginBottom: 12 },
  replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 4 },
  replyBannerText: { color: '#8D8D8D', fontSize: 13 },
  replyCancel: { color: 'rgb(37, 162, 211)', fontSize: 13, fontWeight: '700' },
  inputRow:{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 12 },
  postBtn: { backgroundColor: 'rgb(37, 162, 211)', borderRadius: COMMON_RADIUS, paddingHorizontal: 16, paddingVertical: 9 },
  postBtnText: { color: '#000000', fontWeight: '700', fontSize: 14 },
  empty:   { color: '#8D8D8D', fontSize: 14, textAlign: 'center', paddingVertical: 20 },
});
