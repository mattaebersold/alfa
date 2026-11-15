import React, { useLayoutEffect, useState, useRef, useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  View, StyleSheet, ActivityIndicator, Alert, Keyboard, Platform, TouchableOpacity,
} from 'react-native';
import { X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { Text } from '../../theme/Text';
import { useCreateCommentMutation } from '../../api/apiService';
import { useCommentThread } from '../../hooks/useCommentThread';
import { useAppSelector } from '../../store/store';
import Avatar from '../ui/Avatar';
import CommentRow from './CommentRow';
import Composer, { type ComposerHandle } from './Composer';
import { useComposerPhotos } from '../../hooks/useComposerPhotos';
import UserSummaryModal from '../members/UserSummaryModal';
import { type SummaryOrigin, useSummaryPanel } from '../ui/SummaryModal';
import { useColors } from '../../hooks/useColors';
import { contrastText } from '../../hooks/useBrandColor';
import { PILL_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'
import PanelEmpty from '../ui/PanelEmpty';

interface InlineCommentsProps {
  /** internal_id of the thing being commented on. */
  documentId: string;
  /** Backend entry type, e.g. 'garagecar' or 'post'. */
  entryType: string;
  /** Section heading; pass '' to render none (a panel pins its own). */
  title?: string;
  /** Background for the section, so it can be set off from the page. */
  backgroundColor?: string;
  /**
   * Where the thread sits. Inline on a page it's a section: set off from what's
   * above by a rule and some room, and the composer leads with your avatar. In
   * a panel of its own (PostCommentsModal) it's the whole thing, so there's
   * nothing to be set off from and no one else's avatar on the panel to tell
   * yours apart from — both go.
   */
  variant?: 'inline' | 'panel';
  /** Inline, without the rule and room above it — for a host that spaces its own sections. */
  bare?: boolean;
  /**
   * In a panel, the composer pinned to the panel's foot (SummaryPanelHandle's
   * setFooter) rather than after the thread — for a panel with something above
   * the thread, where the composer would otherwise sit wherever the thread
   * happened to end.
   */
  pinComposer?: boolean;
}

/** The pinned composer's blur strength (iOS). */
const PINNED_BLUR = 30;
/**
 * Its tint over the blur: black at half. Android has no blur under it, so a
 * heavier tint there keeps the words passing beneath from showing through.
 */
const PINNED_TINT = Platform.OS === 'ios' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.85)';

/** Long enough for the keyboard, and the panel's move for it, to be done. */
const KEYBOARD_SETTLE_MS = 400;
/**
 * Room opened above the thread while the mention suggestions are up.
 *
 * The suggestions draw above the field, inside the thread's scroller, and a
 * scroller clips at its top edge: with a short thread the field is near that
 * edge and the list was cut off under the heading. This spacer makes the
 * content taller than the viewport while the list is open, and the scroller
 * is sent to the field — so what's above the field is now content, and the
 * list draws over it. Taller than the list can be (four names, four cars).
 */
const SUGGESTIONS_ROOM = 300;

/**
 * "Comments" and how many. Its own piece so a panel can pin it above the
 * scrolling thread (PostCommentsModal) while a page keeps it inline.
 */
export function CommentsHeading({ title = 'Comments', count, style }: {
  title?: string;
  count: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <View style={[styles.headingRow, style]}>
      <Text style={[styles.heading, { color: c.fg }]}>{title}</Text>
      {count > 0 && (
        <View style={[styles.countBadge, { backgroundColor: c.segment }]}>
          <Text style={[styles.countText, { color: c.fg }]}>{count}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Comment thread rendered inline in a page rather than in a bottom sheet.
 *
 * Uses the same data hook as CommentsSheet, but plain Views instead of a
 * FlatList — this always sits inside a parent ScrollView, and nesting a
 * same-direction VirtualizedList inside one breaks scrolling and warns.
 */
export default function InlineComments({
  documentId, entryType, title = 'Comments', backgroundColor, variant = 'inline', pinComposer = false, bare = false,
}: InlineCommentsProps) {
  const c = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  const [commentText, setCommentText] = useState('');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  /**
   * The comment a reply is being written to. `rowId` is the row whose button
   * was tapped (it stays lit while you write); `threadId` is the thread's
   * head, what the reply attaches to — the two differ when you reply to a
   * reply. The reply is written in the thread's own composer, full width,
   * with a banner over it saying who it's to — not in a field squeezed into
   * the comment's card.
   */
  const [replyingTo, setReplyingTo] = useState<{ rowId: string; threadId: string; username: string } | null>(null);
  const photos = useComposerPhotos();
  // Tapping a commenter summarises them in place, as it does in the sheet.
  const [userSummary, setUserSummary] = useState<{ userId: string; origin: SummaryOrigin | null } | null>(null);

  const { rows, comments, isFetching } = useCommentThread(entryType, documentId, { skip: !documentId });
  const [createComment, { isLoading: submitting }] = useCreateCommentMutation();
  // In a summary panel, the keyboard shrinks the panel and the composer at
  // its foot can end up under the fold — so the thread scrolls to its end
  // once the keyboard has had its time. On a page the FormScrollView does
  // its own keyboard work and this is null.
  const panel = useSummaryPanel();
  const composerRef = useRef<ComposerHandle>(null);
  /** Each row's view, by id — to scroll to the comment you just posted. */
  const rowViews = useRef(new Map<string, View | null>());
  /**
   * The rows there were before a post went up, until the post shows up in
   * the thread — whichever row is new then is yours, and the panel scrolls to
   * it. Null when nothing is waiting.
   */
  const [awaitingPost, setAwaitingPost] = useState<Set<string> | null>(null);
  /** The mention suggestions are up over the composer — see SUGGESTIONS_ROOM. */
  const [suggesting, setSuggesting] = useState(false);
  const makeRoom = variant === 'panel' && !!panel;

  const onAccent = contrastText(c.primaryAlt);
  const bg = backgroundColor ?? c.bg;
  const tone = { surface: bg, field: c.card, border: c.borderDark, text: c.fg, accent: c.primaryAlt, onAccent };

  const handleSubmit = async () => {
    const fd = new FormData();
    fd.append('document_id', documentId);
    fd.append('document_type', entryType);
    fd.append('body', commentText.trim());
    if (replyingTo) fd.append('reply_to', replyingTo.threadId);
    photos.appendTo(fd);
    if (mentionedUserIds.length > 0) fd.append('mentioned_users', mentionedUserIds.join(','));
    const before = new Set(rows.map(rowKey));
    try {
      await createComment(fd).unwrap();
      setCommentText('');
      setMentionedUserIds([]);
      setReplyingTo(null);
      photos.clear();
      // The keyboard goes; the thread stays up, and is taken to what you
      // posted once it has come back from the server (see awaitingPost).
      Keyboard.dismiss();
      setAwaitingPost(before);
    } catch {
      Alert.alert('Error', replyingTo ? 'Could not post reply.' : 'Could not post comment.');
      // Keeps the composer open with the words still in it.
      return false;
    }
  };

  /**
   * Opening the box to write in takes the panel to its foot — the thread's
   * newest comments and the box itself — and keeps it there while the panel
   * shrinks for the keyboard (SummaryModal's scrollToEnd holds the foot).
   */
  const toFootOnOpen = (isOpen: boolean) => {
    if (!isOpen || !panel) return;
    // The panel holds its foot in view while it shrinks for the keyboard.
    panel.scrollToEnd();
    // And once more when the keyboard has finished, in case it took longer.
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      sub.remove();
      panel.scrollToEnd();
    });
    // Not every open raises the keyboard (it may already be up).
    setTimeout(() => sub.remove(), 1500);
  };

  // Your post has landed in the thread: scroll to it, once the keyboard is
  // down and the panel has grown back to its size.
  useEffect(() => {
    if (!awaitingPost) return;
    const mine = rows.find((r) => !awaitingPost.has(rowKey(r)) && r.comment.user_id === userInfo?.user_id)
      ?? rows.find((r) => !awaitingPost.has(rowKey(r)));
    if (!mine) return;
    setAwaitingPost(null);
    if (!panel) return;
    const t = setTimeout(() => panel.scrollIntoView(rowViews.current.get(rowKey(mine)) ?? null), KEYBOARD_SETTLE_MS);
    return () => clearTimeout(t);
  }, [rows, awaitingPost, panel, userInfo?.user_id]);

  const replyBanner = replyingTo ? (
    <View style={[styles.replyBanner, { borderColor: c.borderDark }]}>
      <Text style={[styles.replyText, { color: c.greyDark }]} numberOfLines={1}>
        Replying to <Text style={[styles.replyName, { color: c.fg }]}>@{replyingTo.username}</Text>
      </Text>
      <TouchableOpacity
        onPress={() => setReplyingTo(null)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Stop replying"
      >
        <X size={16} color={c.greyDark} />
      </TouchableOpacity>
    </View>
  ) : null;

  const composerEl = (
    <Composer
      ref={composerRef}
      value={commentText}
      onOpenChange={toFootOnOpen}
      onChangeText={(text, ids) => { setCommentText(text); setMentionedUserIds(ids); }}
      placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Write a comment...'}
      photos={photos}
      onSend={handleSubmit}
      sending={submitting}
      mentions
      sendLabel={replyingTo ? 'Reply' : 'Post'}
      banner={replyBanner}
      onSuggestionsOpenChange={makeRoom ? setSuggesting : undefined}
      tone={tone}
      barStyle={styles.composer}
      sendIcon
      attachField
      // Boxed at a fixed size: in a row whose other child grows, the avatar
      // was picking up the leftover width and drawing as a wide rectangle
      // instead of a circle.
      leading={variant === 'inline' ? (
        <View style={styles.avatarBox}>
          <Avatar user={userInfo} size={30} />
        </View>
      ) : undefined}
    />
  );
  /** Pinned to the panel's foot instead of after the thread — see `pinComposer`. */
  const pinned = pinComposer && !!panel;
  useLayoutEffect(() => {
    if (pinned) panel!.setFooter(
      // Over the thread's foot, which scrolls on under it to the panel's edge:
      // a blur of what's passing beneath, darkened to black at half.
      <View style={styles.pinnedComposer}>
        {Platform.OS === 'ios' ? <BlurView tint="dark" intensity={PINNED_BLUR} style={StyleSheet.absoluteFill} /> : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: PINNED_TINT }]} />
        {composerEl}
      </View>,
    );
  });
  useLayoutEffect(() => () => { if (pinned) panel!.setFooter(null); }, [pinned, panel]);

  return (
    <View style={[variant === 'inline' && !bare && styles.framed, { backgroundColor: bg, borderTopColor: c.borderDark }]}>
      {makeRoom && suggesting ? (
        // Laid out before the catch-up scroll, so the field is already at
        // the foot by the time the frame draws.
        <View style={{ height: SUGGESTIONS_ROOM }} onLayout={() => panel?.scrollToEnd(false)} />
      ) : null}
      {title ? <CommentsHeading title={title} count={rows.length} /> : null}

      {isFetching && comments.length === 0 ? (
        <ActivityIndicator color={c.primaryAlt} style={{ marginVertical: 24 }} />
      ) : rows.length === 0 ? (
        variant === 'panel'
          ? <PanelEmpty>No comments yet</PanelEmpty>
          : <Text style={[styles.empty, { color: c.greyDark }]}>No comments yet. Be first!</Text>
      ) : (
        rows.map((item: any) => {
          const rowId = rowKey(item);
          const replyOpen = replyingTo?.rowId === rowId;
          return (
          <View key={rowId} ref={(v) => { rowViews.current.set(rowId, v); }} collapsable={false}>
          <CommentRow
            comment={item.comment}
            currentUserId={userInfo?.user_id}
            isReply={item.isReply}
            // A thread is one card: without these every reply drew its own
            // outline, so an answer read as a separate comment that happened
            // to mention someone.
            isThreadStart={item.isThreadStart}
            isThreadEnd={item.isThreadEnd}
            threadId={item.threadId}
            onOpenUser={(userId, origin) => setUserSummary({ userId, origin })}
            backgroundColor={bg}
            // A panel already insets its content, so the cards take its full width.
            flush={variant === 'panel'}
            // The button toggles: a second tap on the lit one stops replying,
            // and a tap on another comment's moves the reply there.
            replyOpen={replyOpen}
            onReply={(threadId, username) => {
              if (replyOpen) { setReplyingTo(null); return; }
              setReplyingTo({ rowId, threadId, username });
              composerRef.current?.open();
              // Already focused, the field won't announce opening again.
              if (!pinned) panel?.scrollToEnd();
            }}
          />
          </View>
          );
        })
      )}

      {pinned ? null : composerEl}

      <UserSummaryModal
        userId={userSummary?.userId ?? null}
        origin={userSummary?.origin}
        onClose={() => setUserSummary(null)}
      />
    </View>
  );
}

/** A row's id — the comment's, whichever key the server used. */
function rowKey(item: { comment: any }): string {
  return item.comment.internal_id ?? item.comment._id;
}

const styles = StyleSheet.create({
  // Set apart from the shelves above it: more room, and a rule you can see.
  // Comments are the page's conversation, not another row of its content.
  framed:     { marginTop: 28, paddingTop: 20, borderTopWidth: 1 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  // The same heading every shelf on the page wears — see PostStrip, ListShelf.
  heading:    { fontSize: 17, fontFamily: FONT_INTER.bold },
  // A tally beside the heading, not a second heading: small enough to read as
  // a footnote to the word.
  countBadge: {
    minWidth: 18, height: 18, borderRadius: PILL_RADIUS, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  countText:  { fontSize: 10, fontFamily: FONT_INTER.extrabold },

  empty:      { fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },

  // Overridden by the composer's own keyboard padding (useKeyboardPadding
  // sets paddingBottom), so room under the bar goes on its wrapper instead.
  composer:  { paddingBottom: 6 },
  // Pinned to a panel's foot: 8 here plus the bar's own 10 under the field
  // makes 18 — the same as above the panel's tabs (PostReactionsSummaryModal).
  // Its sides a little further in than the bar's own 12, off the panel's edge.
  pinnedComposer: { paddingTop: 8, paddingBottom: 8, paddingHorizontal: 6 },
  // Android draws the panel's foot tighter under the bar than iOS does —
  // the Post button sat nearly on the edge — so it gets more room there.
  panelComposer: { paddingBottom: Platform.OS === 'android' ? 16 : 6 },
  // Over the composer while replying: who to, and a way out of it.
  replyBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    marginHorizontal: 12, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: PILL_RADIUS,
  },
  replyText: { flex: 1, fontSize: 13, fontFamily: FONT_INTER.medium },
  replyName: { fontFamily: FONT_INTER.bold },
  avatarBox: { width: 30, height: 30, flexGrow: 0, flexShrink: 0 },
});
