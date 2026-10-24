import React, { useState } from 'react';
import {
  View, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Keyboard,
} from 'react-native';
import { Text } from '@ors/kit';
import { carScopeKey } from '../../utils/carScope';
import { FormScrollView } from '@ors/kit';
import { WebView } from 'react-native-webview';
import { ExternalLink, Pencil, Trash2, ChevronRight, Settings, Images } from 'lucide-react-native';
import { Linking } from 'react-native';
import { shortTimeAgo } from '../../utils/shortTimeAgo';
import {
  useCreateCommentMutation,
  useDeleteGroupDiscussionPostMutation,
  useDeleteGroupResourceMutation,
} from '../../api/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import GroupItemActions from './GroupItemActions';
import { useCommentThread } from '../../hooks/useCommentThread';
import { useAppSelector } from '../../store/store';
import Avatar from '../ui/Avatar';
import MentionInput from '../ui/MentionInput';
import ActionSheet from '../ui/ActionSheet';
import PostMediaCarousel, { PageDots } from '../media/PostMediaCarousel';
import { postMediaList, type PostMedia } from '../../utils/postMedia';
import CommentRow, { type CommentData } from '../social/CommentRow';
import SharedModal, { PANE_GUTTER, PANE_GRABBER_H } from '../ui/SharedModal';
import SharedButton from '../ui/SharedButton';
import GroupCreateSheet from './GroupCreateSheet';
import { imageUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import { ss } from '../../styles/shared';
import {
  COMMON_RADIUS,
  PILL_RADIUS,
  COLOR_BLACK,
  COLOR_GRAY_141,
  COLOR_GRAY_180,
  COLOR_GRAY_236,
  COLOR_GRAY_42,
  COLOR_GRAY_13,
  COLOR_GRAY_102,
  COLOR_WHITE,
} from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

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
  // The Post button in the member's own colour: blue, or Pro red.
  const brand = useBrandColor();
  const insets = useSafeAreaInsets();
  const [deleteDiscussion, { isLoading: deletingDiscussion }] = useDeleteGroupDiscussionPostMutation();
  const [deleteResource, { isLoading: deletingResource }] = useDeleteGroupResourceMutation();
  const deleting = deletingDiscussion || deletingResource;
  const [editOpen, setEditOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const entryType = kind ? ENTRY_TYPE[kind] : '';
  const id = item?.internal_id ?? '';

  const { rows, comments, isFetching } = useCommentThread(entryType, id, {
    skip: !visible || !id || !entryType,
    newestFirst: true,
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
  /**
   * What this item's list is cached under: its group — or, for a post on a
   * car model's page, that model (see utils/carScope). Mutations refresh it.
   */
  const scopeKey: string = d?.group_id || carScopeKey(d?.make, d?.model);
  const carScope = !d?.group_id && d?.make && d?.model ? { make: d.make, model: d.model } : undefined;
  const gallery = d.gallery ?? [];
  // The gallery, or an older entry's lone image.
  const legacyImage = d.image ? imageUrl(d.image) : null;
  const media: PostMedia[] = gallery.length > 0
    ? postMediaList({ gallery, video_id: d.video_id })
    : legacyImage ? [{ kind: 'image', key: 'image', url: legacyImage }] : [];
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
          const args = { internal_id: d.internal_id, group_id: scopeKey };
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
    // No title row: the item's own title heads it, and "Discussion" over it
    // said nothing the content didn't.
    // Edge to edge: the content runs on under the home indicator rather than
    // being cut off above it, and pads its own foot clear of it.
    // Holds still for the keyboard while the edit pane is over it — see
    // keyboardInert. Its own form scroller likewise.
    <SharedModal visible={visible} onClose={onClose} hideHeader edgeToEdge keyboardInert={editOpen}>
      <FormScrollView enabled={!editOpen} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, !onViewMore && { paddingBottom: insets.bottom + 40 }]}>
        {/* Media */}
        {ytId ? (
          <View style={styles.ytWrap}>
            <WebView source={{ uri: `https://www.youtube.com/embed/${ytId}` }} style={styles.ytPlayer} allowsFullscreenVideo javaScriptEnabled />
          </View>
        ) : media.length ? (
          // As the feed card draws it: one strip, each slide at its own shape
          // with the height easing between them, dots at the foot, a pinch for
          // a closer look.
          <PostMediaCarousel
            media={media}
            adaptiveHeight
            visible={visible}
            pinchZoom
            // The feed card's pager: the dots in a pill with the gallery
            // icon, bottom left, rather than centred at the foot.
            showPageIndicator={false}
            overlay={({ active }) => (media.length > 1 ? (
              <View style={styles.galleryRow} pointerEvents="none">
                <View style={styles.galleryPill} accessibilityLabel={`${media.length} photos`}>
                  <Images size={16} color={COLOR_WHITE} strokeWidth={2} />
                  <PageDots count={media.length} active={active} />
                </View>
              </View>
            ) : null)}
          />
        ) : null}

        {/* Right under the grabber when there's no media over it. */}
        <View style={[styles.body, !(ytId || media.length) && styles.bodyBare]}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{d.title}</Text>
            {/* The author's own controls, behind a cog rather than laid out
                as buttons — they're rarely wanted, and never by anyone else. */}
            {canManage && (
              <TouchableOpacity
                onPress={() => setMenuOpen(true)}
                disabled={deleting}
                hitSlop={10}
                style={[styles.cog, deleting && { opacity: 0.4 }]}
                accessibilityRole="button"
                accessibilityLabel={`${kindLabel} options`}
              >
                <Settings size={18} color={COLOR_GRAY_141} />
              </TouchableOpacity>
            )}
          </View>
          {categoryLabel ? (
            <View style={styles.catChip}>
              <Text style={styles.catChipText}>{categoryLabel}</Text>
            </View>
          ) : null}
          {/* The author as the list row shows them — see GroupDetailScreen. */}
          <View style={styles.meta}>
            <Avatar user={d.user} size={22} />
            <Text style={styles.metaText} numberOfLines={1}>
              {d.user?.username ?? 'member'}
              {d.created_at ? <Text style={styles.metaWhen}>{`  ${shortTimeAgo(d.created_at)}`}</Text> : null}
            </Text>
            {/* Like and comment at the row's end, as on the list row. */}
            <GroupItemActions kind={kind} item={d} style={styles.metaActions} />
          </View>
          {d.body ? <Text style={styles.text}>{stripHtml(d.body)}</Text> : null}


          {/* Resource link */}
          {kind === 'resource' && d.url && !ytId ? (
            <SharedButton label="Open Link" Icon={ExternalLink} onPress={() => Linking.openURL(d.url)} full style={{ marginTop: 16 }} />
          ) : null}

          {/* Comments, ruled off from what they're about. */}
          <View style={styles.rule} />

          {replyingTo && (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText}>
                Replying to <Text style={{ fontWeight: '700', color: COLOR_GRAY_236 }}>@{replyingTo.username}</Text>
              </Text>
              <TouchableOpacity onPress={() => { setReplyingTo(null); setCommentText(''); }} hitSlop={8}>
                <Text style={styles.replyCancel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputRow}>
            <MentionInput
              containerStyle={{ flex: 1 }}
              style={[ss.chatInput, { borderColor: COLOR_GRAY_42, backgroundColor: COLOR_GRAY_13, color: COLOR_GRAY_236, maxHeight: 120 }]}
              value={commentText}
              onChangeText={(t, ids) => { setCommentText(t); setMentionedIds(ids); }}
              placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Write a comment...'}
              placeholderTextColor={COLOR_GRAY_141}
              multiline
            />
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting || !commentText.trim()}
              style={[styles.postBtn, { backgroundColor: brand }, (!commentText.trim() || submitting) && { opacity: 0.4 }]}
            >
              <Text style={[styles.postBtnText, { color: contrastText(brand) }]}>Post</Text>
            </TouchableOpacity>
          </View>

          {isFetching && comments.length === 0 ? (
            <ActivityIndicator size="small" color={COLOR_GRAY_141} style={{ marginTop: 16 }} />
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
                flush
                compact
                backgroundColor={COLOR_GRAY_13}
                onReply={(commentId, username) => {
                  setReplyingTo({ commentId, username });
                  setCommentText(`@${username} `);
                }}
              />
            ))
          )}
        </View>
      </FormScrollView>

      {onViewMore && (
        /* Below the scroller, not in it: it's the way out of this summary, and
           somewhere in the middle of a long discussion is not where you look
           for one. Closing first — the navigation happens on the other side of
           the dismissal, because iOS won't present over a modal that is still
           going away. */
        <TouchableOpacity
          style={[styles.viewMore, { borderTopColor: colors.border, paddingBottom: 15 + insets.bottom }]}
          onPress={() => { onClose(); onViewMore(); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.viewMoreText, { color: colors.primaryAlt }]}>View in group</Text>
          <ChevronRight size={15} color={colors.primaryAlt} />
        </TouchableOpacity>
      )}


      {canManage && (
        <ActionSheet
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          title={`Your ${kindLabel.toLowerCase()}`}
          options={[
            { label: 'Edit', Icon: Pencil, onPress: () => setEditOpen(true) },
            { label: 'Delete', Icon: Trash2, destructive: true, onPress: confirmDelete },
          ]}
        />
      )}

      {/* Inside this modal's tree, so it presents over it rather than needing
          the detail closed first. */}
      {canManage && (
        <GroupCreateSheet
          kind={kind === 'resource' ? 'resources' : 'discussion'}
          groupId={scopeKey}
          scope={carScope}
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
  viewMoreText: { fontSize: 15, fontFamily: FONT_INTER.extrabold },

  // Media runs right up under the floating grabber; without any, the body
  // starts clear of it — see PANE_GRABBER_H.
  scroll:  { paddingBottom: 40 },
  ytWrap:  { width: '100%', aspectRatio: 16 / 9, backgroundColor: COLOR_BLACK },
  ytPlayer:{ flex: 1, backgroundColor: COLOR_BLACK },
  body:    { padding: PANE_GUTTER },
  bodyBare:{ paddingTop: PANE_GRABBER_H + 2 },
  // The feed card's gallery pill — see FeedItemCard.
  galleryRow:  { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center' },
  galleryPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 13, paddingVertical: 9, borderRadius: PILL_RADIUS },
  catChip: { alignSelf: 'flex-start', backgroundColor: COLOR_GRAY_42, paddingHorizontal: 8, paddingVertical: 3, borderRadius: PILL_RADIUS, marginBottom: 12 },
  catChipText: { color: COLOR_GRAY_180, fontSize: 10, fontFamily: FONT_INTER.extrabold },
  titleRow:{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  title:   { flex: 1, fontSize: 20, fontFamily: FONT_INTER.bold, color: COLOR_WHITE, lineHeight: 26 },
  // Centred on the title's first line.
  cog:     { paddingTop: 4 },
  meta:    { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 },
  metaText:{ fontSize: 12, fontFamily: FONT_INTER.semibold, color: COLOR_WHITE, flexShrink: 1 },
  metaWhen:{ color: COLOR_GRAY_102, fontFamily: FONT_INTER.regular },
  metaActions: { marginLeft: 'auto' },
  text:    { fontSize: 15, lineHeight: 24, color: COLOR_GRAY_236 },
  // A full point of faint white: a hairline in the theme's border vanished on the pane.
  // Out through the body's padding, edge to edge.
  rule:    { height: 1, marginTop: 24, marginBottom: 18, marginHorizontal: -PANE_GUTTER, backgroundColor: 'rgba(255,255,255,0.08)' },
  replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 4 },
  replyBannerText: { color: COLOR_GRAY_141, fontSize: 13 },
  replyCancel: { color: 'rgb(54, 178, 226)', fontSize: 13, fontFamily: FONT_INTER.bold },
  inputRow:{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 12 },
  postBtn: { borderRadius: COMMON_RADIUS, paddingHorizontal: 16, paddingVertical: 9 },
  postBtnText: { color: COLOR_BLACK, fontFamily: FONT_INTER.bold, fontSize: 14 },
  empty:   { color: COLOR_GRAY_141, fontSize: 14, textAlign: 'center', paddingVertical: 20 },
});
