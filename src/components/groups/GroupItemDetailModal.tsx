import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, Dimensions, ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import { ExternalLink, ThumbsUp, ThumbsDown } from 'lucide-react-native';
import { Linking } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import {
  useCreateCommentMutation,
  useUpvoteGroupForumPostMutation,
  useDownvoteGroupForumPostMutation,
} from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useCommentThread } from '../../hooks/useCommentThread';
import { useAppSelector } from '../../store/store';
import Avatar from '../ui/Avatar';
import MentionInput from '../ui/MentionInput';
import ImageLightbox from '../ui/ImageLightbox';
import CommentRow, { type CommentData } from '../social/CommentRow';
import SharedModal from '../ui/SharedModal';
import SharedButton from '../ui/SharedButton';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import { ss } from '../../styles/shared';

const SCREEN_WIDTH = Dimensions.get('window').width;

type Kind = 'news' | 'forum' | 'resource';
const ENTRY_TYPE: Record<Kind, string> = {
  news: 'groupnews',
  forum: 'groupforum',
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
  visible: boolean;
  onClose: () => void;
}

export default function GroupItemDetailModal({ item, kind, categoryLabel, visible, onClose }: Props) {
  const { userInfo } = useAppSelector((s) => s.auth);
  const colors = useColors();
  const [upvote, { isLoading: upvoting }] = useUpvoteGroupForumPostMutation();
  const [downvote, { isLoading: downvoting }] = useDownvoteGroupForumPostMutation();
  const voting = upvoting || downvoting;
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
  const kindLabel = kind === 'news' ? 'News' : kind === 'resource' ? 'Resource' : 'Forum';
  const ytId = kind === 'resource' ? youtubeId(d.url) : null;

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
            <Text style={styles.metaText}>@{d.user?.username} · {timeAgo}</Text>
          </View>
          {d.body ? <Text style={styles.text}>{stripHtml(d.body)}</Text> : null}

          {/* Voting. Lives here rather than on the list row — it's a response to
              having read the thing, and the row is a link, not a control. */}
          {kind === 'forum' && (
            <View style={styles.voteRow}>
              <TouchableOpacity
                style={[styles.voteBtn, { borderColor: colors.borderDark }]}
                onPress={() => upvote({ internal_id: d.internal_id, group_id: d.group_id })}
                disabled={voting}
                accessibilityRole="button"
                accessibilityLabel="Upvote"
              >
                <ThumbsUp size={16} color={colors.fg} />
                <Text style={[styles.voteCount, { color: colors.fg }]}>{d.upvotes ?? 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.voteBtn, { borderColor: colors.borderDark }]}
                onPress={() => downvote({ internal_id: d.internal_id, group_id: d.group_id })}
                disabled={voting}
                accessibilityRole="button"
                accessibilityLabel="Downvote"
              >
                <ThumbsDown size={16} color={colors.fg} />
                <Text style={[styles.voteCount, { color: colors.fg }]}>{d.downvotes ?? 0}</Text>
              </TouchableOpacity>
            </View>
          )}

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

      <ImageLightbox
        images={zoomUrls}
        initialIndex={zoomIndex ?? 0}
        visible={zoomIndex !== null}
        onClose={() => setZoomIndex(null)}
      />
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  scroll:  { paddingBottom: 40 },
  ytWrap:  { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  ytPlayer:{ flex: 1, backgroundColor: '#000' },
  hero:    { width: '100%', aspectRatio: 16 / 9 },
  galleryImage: { width: SCREEN_WIDTH, aspectRatio: 16 / 9 },
  body:    { padding: 16 },
  catChip: { alignSelf: 'flex-start', backgroundColor: '#2A2A2A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, marginBottom: 8 },
  catChipText: { color: '#B4B4B4', fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  title:   { fontSize: 20, fontWeight: '800', color: '#FFFFFF', lineHeight: 26, marginBottom: 12 },
  meta:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  metaText:{ fontSize: 12, color: '#B4B4B4' },
  voteRow:  { flexDirection: 'row', gap: 10, marginTop: 18 },
  voteBtn:  {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 999, borderWidth: 1,
  },
  voteCount:{ fontSize: 14, fontWeight: '700' },
  text:    { fontSize: 15, lineHeight: 24, color: '#ECECEC' },
  commentsHeading: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginTop: 24, marginBottom: 12 },
  replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 4 },
  replyBannerText: { color: '#8D8D8D', fontSize: 13 },
  replyCancel: { color: 'rgb(37, 162, 211)', fontSize: 13, fontWeight: '700' },
  inputRow:{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 12 },
  postBtn: { backgroundColor: 'rgb(37, 162, 211)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9 },
  postBtnText: { color: '#000000', fontWeight: '700', fontSize: 14 },
  empty:   { color: '#8D8D8D', fontSize: 14, textAlign: 'center', paddingVertical: 20 },
});
