import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { MoreVertical, Trash2, Reply } from 'lucide-react-native';
import { formatDistanceToNowStrict } from 'date-fns';
import Avatar from '../ui/Avatar';
import MentionText from '../ui/MentionText';
import ReportButton from '../ui/ReportButton';
import ActionSheet from '../ui/ActionSheet';
import { useGetUserByIdQuery, useDeleteCommentMutation, useGetLikeInfoQuery } from '../../api/apiService';
import LikeButton from './LikeButton';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { contrastText } from '../../hooks/useBrandColor';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import ImageLightbox from '../ui/ImageLightbox';
import { imageUrl } from '../../utils/image';
import type { GalleryItem } from '../../types/api';
import { FONT_INTER } from '../../constants/fonts';
import { COLOR_GRAY_11, COLOR_GRAY_42 } from '../../constants/config';

/**
 * The ground comments sit on, wherever they appear.
 *
 * Exported so the sheet and the post detail can't drift apart: the two used
 * different greys (#161616 and #101010) for the same thing, alongside a third
 * for the composer and a fourth for the header.
 */
export const COMMENT_SURFACE = COLOR_GRAY_11;

/** Between photos in a comment's strip. */
const PHOTO_GAP = 8;
/** The card's side padding, and a reply's deeper left one (room for its line). */
const CARD_PAD_X = 14;
const REPLY_PAD_L = 30;

export interface CommentData {
  internal_id?: string;
  _id?: string;
  user_id: string;
  /** What the comment is on — used to refresh that thing's count on delete. */
  document_id?: string;
  document_entry_type?: string;
  body?: string;
  created_at?: string;
  /**
   * The author deleted it, but replies hang off it — so the row stays and the
   * words go. See the server's deleteEntry.
   */
  removed?: boolean;
  /**
   * Photos attached to the comment. A comment can be words, a photo, or both —
   * the composer only requires one of the two.
   */
  gallery?: GalleryItem[];
}

interface CommentRowProps {
  comment: CommentData;
  currentUserId?: string;
  onReply?: (commentId: string, username: string) => void;
  isReply?: boolean;
  /**
   * Where this row sits in its thread. A thread — a comment and its replies —
   * is drawn as one card: the first row caps it, the last closes it, and the
   * rows between share its sides. Left unset, a row is a card on its own.
   */
  isThreadStart?: boolean;
  isThreadEnd?: boolean;
  /**
   * The top-level comment of this row's thread. Replies attach to it rather
   * than to each other, so answering a reply lands in the same thread instead
   * of starting a new level of indentation.
   */
  threadId?: string;
  /**
   * Open a summary of whoever wrote this. Passed up rather than owned here:
   * one panel for a list of comments, not one per row.
   */
  onOpenUser?: (userId: string, origin: SummaryOrigin | null) => void;
  /** Override the row background, e.g. to set comments off from a post body. */
  backgroundColor?: string;
  /**
   * Run once the server has confirmed this comment is gone.
   *
   * Opt-in, because what should happen next is the host's business: a full
   * screen of comments stays where it is and simply loses a row, while a sheet
   * opened to deal with one comment has nothing left to be open for. Not called
   * when the delete fails, and not called for a comment that isn't yours —
   * there's no delete on those to begin with.
   */
  onDeleted?: () => void;
  /** The reply field is open under this row — the button shows it. */
  replyOpen?: boolean;
  /**
   * Rendered inside the card, under the comment — the reply field, when it's
   * open here. Inside rather than after, so a thread's one outline still
   * encloses it.
   */
  below?: React.ReactNode;
}

export default function CommentRow({
  comment, currentUserId, onReply, isReply,
  isThreadStart = true, isThreadEnd = true, threadId, onOpenUser, backgroundColor,
  onDeleted, replyOpen = false, below,
}: CommentRowProps) {
  const colors = useColors();
  const hiddenIds = useAppSelector((s) => (s as any).moderation?.hiddenContentIds ?? []);
  const { data: user } = useGetUserByIdQuery(comment.user_id, { skip: !comment.user_id });

  const [deleteComment, { isLoading: deleting }] = useDeleteCommentMutation();
  const [menuOpen, setMenuOpen] = useState(false);
  // Which attached photo is open full-screen, if any.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // The width the words have, which is what the photo strip is sized from.
  const [contentW, setContentW] = useState(0);

  const photos = (comment.gallery ?? [])
    .map((g) => imageUrl(g.filename))
    .filter((u): u is string => !!u);

  const commentId = comment.internal_id ?? comment._id ?? '';
  /**
   * Its like count and whether you're in it. Asked per row rather than in one
   * batch for the thread: a thread is a page of at most fifty short rows, the
   * query is cached by id, and the Like tag the like/unlike mutations
   * invalidate refetches exactly this one — so the heart follows the server
   * without the host having to assemble anything. Every host (sheet, panel,
   * post detail, listing, group item) gets the heart for free.
   */
  const { data: likeInfo } = useGetLikeInfoQuery(commentId, { skip: !commentId || !!comment.removed });
  if (hiddenIds.includes(commentId)) return null;

  const confirmDelete = () => {
    Alert.alert(
      'Delete comment?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteComment({
                id: commentId,
                documentId: comment.document_id,
                documentType: comment.document_entry_type,
              }).unwrap();
              onDeleted?.();
            } catch {
              // Nothing closes on a failure — the comment is still there, and
              // shutting the sheet would be the one thing that makes it look
              // like it worked.
              Alert.alert("Couldn't delete", 'Please try again.');
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const displayName = user?.username || '…';
  const timeAgo = comment.created_at
    ? formatDistanceToNowStrict(new Date(comment.created_at), { addSuffix: true })
    : '';

  const isOwn = currentUserId && currentUserId === comment.user_id;

  // Kept only so its replies still have something to hang off, so it carries
  // none of a comment's furniture — no avatar, no name, nothing to press.
  if (comment.removed) {
    return (
      <View style={[
        styles.container,
        styles.removed,
        { backgroundColor: backgroundColor ?? colors.card, borderColor: colors.borderDark },
        isThreadStart && styles.threadStart,
        isThreadEnd && styles.threadEnd,
        isReply && styles.replyContainer,
      ]}>
        {isReply && <View style={styles.replyLine} />}
        <Text style={[styles.removedText, { color: colors.greyDark }]}>Comment removed</Text>
      </View>
    );
  }

  /**
   * The heart and the reply button, drawn alike: two outlined pills. Beside
   * the words on their last line when the comment is only words; under the
   * photos, on a row of their own, when it has any — beside a photo strip
   * they'd squeeze it, and a row of buttons under a picture is how every
   * other card in the app reads.
   */
  const actions = commentId ? (
    <View style={styles.actions}>
      <LikeButton
        documentId={commentId}
        entryType="comment"
        ownerId={comment.user_id}
        initialLiked={likeInfo?.hasLiked ?? likeInfo?.liked ?? false}
        initialCount={likeInfo?.total ?? likeInfo?.count ?? 0}
        size={16}
        color={colors.greyDark}
        style={[styles.actionBtn, styles.likeBtn, { borderColor: colors.borderDark }]}
      />
      {onReply && (
        <TouchableOpacity
          onPress={() => onReply(threadId ?? commentId, user?.username ?? displayName ?? '')}
          hitSlop={6}
          style={[
            styles.actionBtn,
            { borderColor: colors.borderDark },
            // Filled while its field is open, so the open one is the one
            // that reads as pressed.
            replyOpen && { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt },
          ]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={replyOpen ? 'Cancel reply' : `Reply to @${displayName}`}
          accessibilityState={{ expanded: replyOpen }}
        >
          <Reply size={18} color={replyOpen ? contrastText(colors.primaryAlt) : colors.primaryAlt} />
        </TouchableOpacity>
      )}
    </View>
  ) : null;
  const hasPhotos = photos.length > 0;

  return (
    <View style={[
      styles.container,
      { backgroundColor: backgroundColor ?? colors.card, borderColor: colors.borderDark },
      isThreadStart && styles.threadStart,
      isThreadEnd && styles.threadEnd,
      isReply && styles.replyContainer,
    ]}>
      {/* A hairline in the border colour, not the brand one: it marks the
          indent, it isn't a thing to look at. */}
      {isReply && <View style={styles.replyLine} />}
      {/* Who said it, on one line: a small avatar beside the name, the way a
          byline reads. The words come underneath at the card's full width
          rather than in a column beside the avatar.

          Initials come from the username, not the first name: the label beside
          it says "@username", and two people whose first names start with the
          same letter produced identical circles — which reads as one person's
          photo repeated rather than as two people. */}
      <View style={styles.byline}>
        <SummaryTouchable
          onPress={(origin) => onOpenUser?.(comment.user_id, origin)}
          disabled={!onOpenUser || !comment.user_id}
          accessibilityLabel={`View @${displayName}`}
        >
          <View style={styles.bylineInner}>
            <Avatar
              user={user}
              size={isReply ? 20 : 22}
            />
            <Text style={[styles.name, { color: colors.fg }]}>@{displayName}</Text>
          </View>
        </SummaryTouchable>
        <View style={styles.bylineRight}>
          <Text style={[styles.time, { color: colors.greyDark }]}>{timeAgo}</Text>
          {/* Yours to delete, anyone else's to report — one dim ⋮ either way. */}
          {commentId && (isOwn ? (
            <>
              <TouchableOpacity
                onPress={() => setMenuOpen(true)}
                hitSlop={8}
                style={styles.menuBtn}
                disabled={deleting}
                accessibilityRole="button"
                accessibilityLabel="Comment options"
              >
                <MoreVertical size={16} color="rgba(255,255,255,0.34)" />
              </TouchableOpacity>
              <ActionSheet
                visible={menuOpen}
                onClose={() => setMenuOpen(false)}
                title="Your comment"
                options={[
                  { label: 'Delete Comment', Icon: Trash2, destructive: true, onPress: confirmDelete },
                ]}
              />
            </>
          ) : (
            <ReportButton contentType="comment" contentId={commentId} size={16} />
          ))}
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.content} onLayout={(e) => setContentW(e.nativeEvent.layout.width)}>
          {/* Full white: a comment is something someone said, not a caption
              about it, and at `muted` it sat quieter than the timestamps. */}
          {comment.body ? (
            <MentionText text={comment.body} style={[styles.text, { color: colors.fg }]} />
          ) : null}

          {/* Fixed 16:9 in the thread so a run of comments keeps an even rhythm
              whatever shape the photos are; tapping opens it whole.

              Several photos go in a strip you page through, each at four
              fifths of the width so the next one shows at the edge — the
              peek is what says there's more, without a dot row. One photo
              takes the whole width; there's nothing to peek.

              Sized in points from the measured column rather than by
              percentage: a horizontal scroller's content has no width of its
              own for a percentage to be a share of. The ratio is on the image,
              not on the frame around it — on the frame the image was
              `absoluteFill` inside a box whose own height came from the ratio,
              and laid out at nothing. */}
          {photos.length > 0 && contentW > 0 && (() => {
            const several = photos.length > 1;
            const w = several ? Math.round(contentW * 0.8) : contentW;
            // The strip runs to the card's edges — a photo sliding off under
            // the card's padding, not stopping short of it — while the first
            // and last photos sit where the words do, by carrying the card's
            // padding inside the strip instead.
            const padL = isReply ? REPLY_PAD_L : CARD_PAD_X;
            const padR = CARD_PAD_X;
            return (
              <ScrollView
                horizontal
                scrollEnabled={several}
                showsHorizontalScrollIndicator={false}
                snapToInterval={w + PHOTO_GAP}
                snapToAlignment="start"
                decelerationRate="fast"
                style={{ marginLeft: -padL, marginRight: -padR }}
                contentContainerStyle={[styles.photoRow, { gap: PHOTO_GAP, paddingLeft: padL, paddingRight: padR }]}
                // Beside the words it could steal a vertical swipe; nested in
                // the thread's scroller, this keeps the pages feeling like one.
                nestedScrollEnabled
              >
                {photos.map((uri, i) => (
                  <TouchableOpacity
                    key={`${uri}_${i}`}
                    style={[styles.photoFrame, { width: w, borderColor: colors.borderDark }]}
                    onPress={() => setLightboxIndex(i)}
                    activeOpacity={0.9}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={several ? `View photo ${i + 1} of ${photos.length}` : 'View photo'}
                  >
                    <Image source={{ uri }} style={styles.photo} contentFit="cover" transition={150} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            );
          })()}
        </View>

        {!hasPhotos && actions}
      </View>
      {hasPhotos && <View style={styles.actionsRow}>{actions}</View>}
      {below}
      <ImageLightbox
        images={photos}
        initialIndex={lightboxIndex ?? 0}
        visible={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    paddingHorizontal: CARD_PAD_X,
    paddingVertical: 10,
    // Sides on every row; the caps come from the thread flags, so a comment
    // and its replies are enclosed by one outline rather than stacked as
    // separate slabs divided by seams.
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  threadStart: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
    paddingTop: 12,
  },
  threadEnd: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
    paddingBottom: 12,
    // The gap goes between threads, rather than between every row.
    marginBottom: 10,
  },
  // Half the old inset: a reply is a step in, not a column of its own.
  replyContainer: {
    paddingLeft: REPLY_PAD_L,
    position: 'relative',
  },
  // A thread's hairline outline is drawn in the border grey at under a point
  // wide, which the eye reads darker than the same grey at a point and a
  // half — so the line is thinner, and a shade darker still, to sit with the
  // outline rather than stand out from it. Shorter than the row, too: a mark
  // beside the reply, not a rail down the card.
  replyLine: {
    position: 'absolute',
    left: 14,
    top: 12,
    bottom: 12,
    width: 1,
    borderRadius: 1,
    backgroundColor: COLOR_GRAY_42,
  },
  // The tombstone is a single line, so it centres rather than sitting where an
  // avatar would have put it.
  removed:     { alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  removedText: { fontSize: 12.5, fontStyle: 'italic' },
  menuBtn:  { padding: 4 },

  // Name on the left, when and ⋮ on the right — the row's two ends. The ⋮ is
  // nudged out so its glyph, not its padding, sits on the card's edge.
  byline:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  bylineInner: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  bylineRight: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: -6, flexShrink: 0 },
  // Words on the left, reply button on the right, bottom-aligned so the
  // button sits on the comment's last line however many lines it runs to.
  body:        { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  content:     { flex: 1 },
  actions:     { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  actionsRow:  { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  // The comment is the thing being read; the name is a label on it and the
  // time is a footnote. The weights say so.
  name:     { fontSize: 13, fontFamily: FONT_INTER.medium },
  text:     { fontSize: 14, lineHeight: 20, fontFamily: FONT_INTER.semibold },
  // `alignItems: flex-start` so the row doesn't stretch its children on the
  // cross axis, which is the default and fights an aspect ratio.
  photoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 8 },
  photoFrame: {
    borderRadius: 10, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  photo: { width: '100%', aspectRatio: 16 / 9 },
  time:     { fontSize: 11, fontStyle: 'italic' },
  // Small outlined buttons rather than bare glyphs, so they read as things
  // to press and not as decoration on the comment. The heart's grows into a
  // pill when it has a count to carry.
  actionBtn: {
    minWidth: 32, height: 32, borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
  },
  likeBtn: { paddingHorizontal: 8, gap: 4 },
});
