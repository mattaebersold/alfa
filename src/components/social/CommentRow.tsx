import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Text } from '../../theme/Text';
import { Image } from '../ui/AppImage';
import { MoreVertical, Trash2 } from 'lucide-react-native';
import { shortTimeAgo } from '../../utils/shortTimeAgo';
import Avatar from '../ui/Avatar';
import MentionText from '../ui/MentionText';
import ReportButton from '../ui/ReportButton';
import ActionSheet from '../ui/ActionSheet';
import { useGetUserByIdQuery, useDeleteCommentMutation, useGetLikeInfoQuery } from '../../api/apiService';
import LikeButton from './LikeButton';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { measureOrigin, type SummaryOrigin } from '../ui/SummaryModal';
import ImageLightbox from '../ui/ImageLightbox';
import { imageUrl } from '../../utils/image';
import type { GalleryItem } from '../../types/api';
import { FONT_INTER } from '../../constants/fonts';
import { COLOR_GRAY_208, COLOR_WHITE } from '../../constants/config';

/** Between photos in a comment's strip. */
const PHOTO_GAP = 8;
/** A row's side padding — a little, so the photo and ⋮ aren't on the edge. */
const ROW_PAD_X = 6;
/** The compact bubble's own padding, inside its fill. */
const COMPACT_PAD_X = 12;
/** The commenter's photo, and the room between it and the name and words. */
const AVATAR = 32;
const AVATAR_REPLY = 26;
const AVATAR_COMPACT = 24;
const AVATAR_GAP = 10;
/** A reply steps in by the photo's column, so its photo sits under the words it answers. */
const REPLY_PAD_L = ROW_PAD_X + AVATAR + AVATAR_GAP;

/**
 * One emoji and nothing else — flags, skin tones and ZWJ families included
 * (one grapheme, several code points). Set three times the size: a lone
 * emoji is the whole comment, and at text size it reads as a stray glyph.
 */
const SINGLE_EMOJI = /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}[\uFE0F\p{Emoji_Modifier}]?(?:\u200D\p{Extended_Pictographic}[\uFE0F\p{Emoji_Modifier}]?)*)$/u;
const isSingleEmoji = (s: string) => SINGLE_EMOJI.test(s.trim());

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
  /** No side margin — for a host that already insets its content. */
  flush?: boolean;
  /**
   * The quieter form — smaller text, the name without its @, the short time —
   * for a pane where the comments sit under a post's own body.
   */
  compact?: boolean;
}

export default function CommentRow({
  comment, currentUserId, onReply, isReply,
  isThreadStart = true, isThreadEnd = true, threadId, onOpenUser, backgroundColor,
  onDeleted, replyOpen = false, below, flush = false, compact = false,
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
  const avatarRef = useRef<View>(null);

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

  /**
   * Deletes straight away. The ⋮ and then "Delete Comment" are already two
   * deliberate taps, and a third — an "are you sure?" — only asked the same
   * question again.
   */
  const deleteNow = async () => {
    try {
      await deleteComment({
        id: commentId,
        documentId: comment.document_id,
        documentType: comment.document_entry_type,
      }).unwrap();
      onDeleted?.();
    } catch {
      // Nothing closes on a failure — the comment is still there, and
      // shutting the sheet would be the one thing that makes it look like it
      // worked.
      Alert.alert("Couldn't delete", 'Please try again.');
    }
  };

  const displayName = user?.username || '…';
  const timeAgo = comment.created_at ? shortTimeAgo(comment.created_at) : '';

  const isOwn = currentUserId && currentUserId === comment.user_id;
  const avatarSize = compact ? AVATAR_COMPACT : isReply ? AVATAR_REPLY : AVATAR;
  const canOpenUser = !!onOpenUser && !!comment.user_id;
  /** The summary grows out of the photo, whether it or the name was tapped. */
  const openUser = () => {
    measureOrigin(avatarRef.current, (origin) => onOpenUser?.(comment.user_id, origin));
  };

  // Kept only so its replies still have something to hang off, so it carries
  // none of a comment's furniture — no avatar, no name, nothing to press.
  if (comment.removed) {
    return (
      <View style={[
        styles.container,
        flush && styles.flush,
        compact && styles.containerCompact,
        styles.removed,
        { backgroundColor: backgroundColor ?? (compact ? colors.card : 'transparent') },
        isThreadStart && styles.threadStart,
        isThreadEnd && styles.threadEnd,
        compact && isThreadStart && styles.threadStartCompact,
        compact && isThreadEnd && styles.threadEndCompact,
        isReply && styles.replyContainer,
      ]}>
        <Text style={[styles.removedText, { color: colors.greyDark }]}>Comment removed</Text>
      </View>
    );
  }

  /**
   * On a row of their own under the comment (and its photos), so the words get
   * the card's full width: "Reply" in grey on the left, the heart on the right.
   */
  const actions = commentId ? (
    <View style={styles.actions}>
      {onReply ? (
        <TouchableOpacity
          onPress={() => onReply(threadId ?? commentId, user?.username ?? displayName ?? '')}
          hitSlop={8}
          style={styles.replyBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={replyOpen ? 'Cancel reply' : `Reply to @${displayName}`}
          accessibilityState={{ expanded: replyOpen }}
        >
          {/* In the brand colour while its reply is being written, so the open one stands out. */}
          <Text style={[styles.replyText, { color: replyOpen ? colors.primaryAlt : colors.greyDark }]}>Reply</Text>
        </TouchableOpacity>
      ) : <View />}
      <LikeButton
        documentId={commentId}
        entryType="comment"
        ownerId={comment.user_id}
        initialLiked={likeInfo?.hasLiked ?? likeInfo?.liked ?? false}
        initialCount={likeInfo?.total ?? likeInfo?.count ?? 0}
        size={16}
        color={colors.greyDark}
        // Solid white once anyone has liked it, the count before the heart.
        litOnAny
        litColor={COLOR_WHITE}
        countFirst
        style={[styles.actionBtn, styles.likeBtn]}
      />
    </View>
  ) : null;

  return (
    <View style={[
      styles.container,
      flush && styles.flush,
      compact && styles.containerCompact,
      { backgroundColor: backgroundColor ?? (compact ? colors.card : 'transparent') },
      isThreadStart && styles.threadStart,
      isThreadEnd && styles.threadEnd,
      compact && isThreadStart && styles.threadStartCompact,
      compact && isThreadEnd && styles.threadEndCompact,
      isReply && styles.replyContainer,
    ]}>
      {/* The photo in a column of its own, and everything else — name, time,
          words, photos, Reply and the heart — in a column beside it, so the
          words start under the name rather than under the photo.

          Initials come from the username, not the first name: the label beside
          it is the username, and two people whose first names start with the
          same letter produced identical circles — which reads as one person's
          photo repeated rather than as two people. */}
      <TouchableOpacity
        ref={avatarRef}
        onPress={openUser}
        disabled={!canOpenUser}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`View ${displayName}`}
        style={styles.avatar}
      >
        <Avatar user={user} name={displayName} size={avatarSize} edge={false} />
      </TouchableOpacity>
      <View style={styles.column}>
        <View style={styles.byline}>
          {/* Name, then when — the name pure white, brighter than the words. */}
          <View style={styles.bylineLeft}>
            <TouchableOpacity
              onPress={openUser}
              disabled={!canOpenUser}
              activeOpacity={0.7}
              style={styles.nameBtn}
              accessibilityRole="button"
              accessibilityLabel={`View ${displayName}`}
            >
              <Text style={[styles.name, { color: COLOR_WHITE }]} numberOfLines={1}>{displayName}</Text>
            </TouchableOpacity>
            {timeAgo ? <Text style={[styles.time, { color: colors.greyDark }]}>{timeAgo}</Text> : null}
          </View>
          {/* Yours to delete, anyone else's to report — one dim ⋮ either way. */}
          {commentId ? (
            <View style={styles.bylineRight}>
              {isOwn ? (
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
                      { label: 'Delete Comment', Icon: Trash2, destructive: true, onPress: deleteNow },
                    ]}
                  />
                </>
              ) : (
                <ReportButton contentType="comment" contentId={commentId} size={16} />
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.content} onLayout={(e) => setContentW(e.nativeEvent.layout.width)}>
          {comment.body ? (
            <MentionText
              text={comment.body}
              style={[styles.text, compact && styles.textCompact, isSingleEmoji(comment.body) && (compact ? styles.emojiCompact : styles.emoji)]}
            />
          ) : null}

          {/* Fixed 16:9 in the thread so a run of comments keeps an even rhythm
              whatever shape the photos are; tapping opens it whole.

              Several photos go in a strip you page through, each at four
              fifths of the width so the next one shows at the edge — the
              peek is what says there's more, without a dot row. One photo
              takes the whole width; there's nothing to peek.

              Sized in points from the measured column rather than by
              percentage: a horizontal scroller's content has no width of its
              own for a percentage to be a share of. */}
          {photos.length > 0 && contentW > 0 && (() => {
            const several = photos.length > 1;
            const w = several ? Math.round(contentW * 0.8) : contentW;
            // Runs on past the row's right padding, so a photo slides off at
            // the edge rather than stopping short of it.
            const padR = compact ? COMPACT_PAD_X : ROW_PAD_X;
            return (
              <ScrollView
                horizontal
                scrollEnabled={several}
                showsHorizontalScrollIndicator={false}
                snapToInterval={w + PHOTO_GAP}
                snapToAlignment="start"
                decelerationRate="fast"
                style={{ marginRight: -padR }}
                contentContainerStyle={[styles.photoRow, { gap: PHOTO_GAP, paddingRight: padR }]}
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

        {actions}
        {below}
      </View>
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
  // No padding and no outline: the words sit straight on the surface, and
  // the room between threads is what groups a comment with its replies.
  container: {
    marginHorizontal: 12,
    paddingHorizontal: ROW_PAD_X,
    flexDirection: 'row', alignItems: 'flex-start', gap: AVATAR_GAP,
    // Between the rows of a thread; threadEnd adds more between threads.
    marginBottom: 8,
  },
  flush: { marginHorizontal: 0 },
  // The compact form keeps its filled bubble, padded inside it.
  containerCompact: { paddingHorizontal: COMPACT_PAD_X, paddingVertical: 7 },
  threadStart: {
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
  },
  threadEnd: {
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
    // The bigger gap goes between threads.
    marginBottom: 20,
  },
  // The compact caps: closer in, and rounder.
  threadStartCompact: { paddingTop: 9, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  threadEndCompact:   { paddingBottom: 9, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  // Half the old inset: a reply is a step in, not a column of its own.
  replyContainer: {
    paddingLeft: REPLY_PAD_L,
    position: 'relative',
  },
  // The tombstone is a single line, so it centres rather than sitting where an
  // avatar would have put it.
  removed:     { alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  removedText: { fontSize: 12.5, fontStyle: 'italic' },
  menuBtn:  { padding: 4 },

  avatar:      { flexShrink: 0 },
  // Everything beside the photo.
  column:      { flex: 1, minWidth: 0 },
  // Name and time on the left, the ⋮ on the right. The ⋮ is nudged out so
  // its glyph, not its padding, sits on the row's edge.
  byline:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  bylineLeft:  { flexDirection: 'row', alignItems: 'baseline', gap: 7, flexShrink: 1, minWidth: 0 },
  nameBtn:     { flexShrink: 1, minWidth: 0 },
  bylineRight: { flexDirection: 'row', alignItems: 'center', marginRight: -6, marginVertical: -4, flexShrink: 0 },
  content:     { alignSelf: 'stretch' },
  // Reply at the start, the heart at the end — pulled out by its padding so
  // its glyph sits on the card's edge, under the ⋮.
  actions:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginRight: -8 },
  replyBtn:    { height: 30, justifyContent: 'center' },
  replyText:   { fontSize: 13, fontFamily: FONT_INTER.semibold },
  // The comment is the thing being read; the name is a label on it and the
  // time is a footnote. The weights say so.
  name:     { fontSize: 13, fontFamily: FONT_INTER.medium },
  // A shade under white, so the name above it leads.
  text:     { fontSize: 14, lineHeight: 20, fontFamily: FONT_INTER.semibold, color: COLOR_GRAY_208 },
  textCompact: { fontSize: 13, lineHeight: 18, color: COLOR_GRAY_208 },
  // A lone emoji, three times the words' size.
  emoji:        { fontSize: 14 * 3, lineHeight: 20 * 3 },
  emojiCompact: { fontSize: 13 * 3, lineHeight: 18 * 3 },
  // `alignItems: flex-start` so the row doesn't stretch its children on the
  // cross axis, which is the default and fights an aspect ratio.
  photoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 8 },
  photoFrame: {
    borderRadius: 10, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  photo: { width: '100%', aspectRatio: 16 / 9 },
  time:     { fontSize: 11, fontStyle: 'italic' },
  // Bare glyphs, no outline. The heart's widens when it has a count to carry.
  actionBtn: {
    minWidth: 32, height: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  likeBtn: { paddingHorizontal: 8, gap: 4 },
});
