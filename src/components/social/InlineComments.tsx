import React, { useState, useRef, useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  View, StyleSheet, ActivityIndicator, Alert, Keyboard, Platform,
} from 'react-native';
import { Text } from '@ors/kit';
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
}

/** Long enough for the keyboard, and the panel's move for it, to be done. */
const KEYBOARD_SETTLE_MS = 400;
/**
 * How long a just-posted comment stays on screen before a panel closes on it.
 * Long enough to see it land in the thread; short enough that the close reads
 * as the end of posting rather than as the panel going by itself.
 */
const CLOSE_AFTER_POST_MS = 1000;
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
 * In a summary panel, close it a beat after a comment goes up. Inline on a
 * page there's no panel and this does nothing. The timer is the caller's to
 * clear on unmount.
 */
function useCloseAfterPost(panel: ReturnType<typeof useSummaryPanel>) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return () => {
    if (!panel) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => panel.closeThen(), CLOSE_AFTER_POST_MS);
  };
}

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
 * The reply field that opens under a comment when its reply button is tapped.
 *
 * Its own component, mounted fresh per target, so the words, mentions and
 * photos of one reply start empty and die with it — there's nothing to reset
 * when it closes, and nothing from the main composer to share or confuse with.
 * The keyboard comes up on mount: you tapped Reply to type.
 */
function ReplyComposer({ documentId, entryType, replyTo, username, tone, onDone, onSuggestionsOpenChange }: {
  documentId: string;
  entryType: string;
  /** The thread's top-level comment — what the reply hangs off. */
  replyTo: string;
  username: string;
  tone: React.ComponentProps<typeof Composer>['tone'];
  /** Posted, or given up on — the field goes either way. */
  onDone: () => void;
  /** See MentionInput; the thread makes room above itself. */
  onSuggestionsOpenChange?: (open: boolean) => void;
}) {
  const [text, setText] = useState('');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const photos = useComposerPhotos();
  const ref = useRef<ComposerHandle>(null);
  const box = useRef<View>(null);
  const panel = useSummaryPanel();
  const closeAfterPost = useCloseAfterPost(panel);
  const [createComment, { isLoading: submitting }] = useCreateCommentMutation();

  useEffect(() => {
    ref.current?.open();
    // In a summary panel the keyboard shrinks the panel rather than lifting
    // it, so a field low in the thread can end up under the fold. Asked for
    // once the keyboard's animation has had its time.
    if (!panel) return;
    const t = setTimeout(() => panel.scrollIntoView(box.current), KEYBOARD_SETTLE_MS);
    return () => clearTimeout(t);
  }, [panel]);

  const send = async () => {
    const fd = new FormData();
    fd.append('document_id', documentId);
    fd.append('document_type', entryType);
    fd.append('body', text.trim());
    fd.append('reply_to', replyTo);
    photos.appendTo(fd);
    if (mentionedUserIds.length > 0) fd.append('mentioned_users', mentionedUserIds.join(','));
    try {
      await createComment(fd).unwrap();
      Keyboard.dismiss();
      onDone();
      closeAfterPost();
    } catch {
      Alert.alert('Error', 'Could not post reply.');
      return false;
    }
  };

  return (
    <View ref={box}>
      <Composer
        ref={ref}
        value={text}
        onChangeText={(t, ids) => { setText(t); setMentionedUserIds(ids); }}
        placeholder={`Reply to @${username}...`}
        photos={photos}
        onSend={send}
        sending={submitting}
        mentions
        sendLabel="Reply"
        tone={tone}
        attachField
        barStyle={styles.replyComposer}
        onSuggestionsOpenChange={(open) => {
          onSuggestionsOpenChange?.(open);
          // Once the room above has laid out, the field back into view.
          if (open && panel) setTimeout(() => panel.scrollIntoView(box.current), 50);
        }}
      />
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
  documentId, entryType, title = 'Comments', backgroundColor, variant = 'inline',
}: InlineCommentsProps) {
  const c = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  const [commentText, setCommentText] = useState('');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  /**
   * The comment a reply is being written under. `rowId` is the row whose
   * button was tapped, where the field opens; `threadId` is the thread's head,
   * what the reply attaches to — the two differ when you reply to a reply.
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
  const closeAfterPost = useCloseAfterPost(panel);
  /** The mention suggestions are up over one of the fields — see SUGGESTIONS_ROOM. */
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
    photos.appendTo(fd);
    if (mentionedUserIds.length > 0) fd.append('mentioned_users', mentionedUserIds.join(','));
    try {
      await createComment(fd).unwrap();
      setCommentText('');
      setMentionedUserIds([]);
      photos.clear();
      // Clear the keyboard off the comment you just posted; in a panel, the
      // panel follows a beat later, once the comment has been seen to land.
      Keyboard.dismiss();
      closeAfterPost();
    } catch {
      Alert.alert('Error', 'Could not post comment.');
      // Keeps the composer open with the words still in it.
      return false;
    }
  };

  return (
    <View style={[variant === 'inline' && styles.framed, { backgroundColor: bg, borderTopColor: c.borderDark }]}>
      {makeRoom && suggesting ? (
        // Laid out before the catch-up scroll, so the field is already at
        // the foot by the time the frame draws.
        <View style={{ height: SUGGESTIONS_ROOM }} onLayout={() => panel?.scrollToEnd(false)} />
      ) : null}
      {title ? <CommentsHeading title={title} count={comments.length} /> : null}

      {isFetching && comments.length === 0 ? (
        <ActivityIndicator color={c.primaryAlt} style={{ marginVertical: 24 }} />
      ) : rows.length === 0 ? (
        <Text style={[styles.empty, { color: c.greyDark }]}>No comments yet. Be first!</Text>
      ) : (
        rows.map((item: any) => {
          const rowId: string = item.comment.internal_id ?? item.comment._id;
          const replyOpen = replyingTo?.rowId === rowId;
          return (
          <CommentRow
            key={rowId}
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
            // The button toggles: a second tap on the open one puts the field
            // away, and a tap on another comment's moves it there.
            replyOpen={replyOpen}
            onReply={(threadId, username) => {
              setReplyingTo(replyOpen ? null : { rowId, threadId, username });
            }}
            below={replyOpen && replyingTo ? (
              <ReplyComposer
                // Fresh state per target, see ReplyComposer.
                key={rowId}
                documentId={documentId}
                entryType={entryType}
                replyTo={replyingTo.threadId}
                username={replyingTo.username}
                tone={tone}
                onDone={() => setReplyingTo(null)}
                onSuggestionsOpenChange={makeRoom ? setSuggesting : undefined}
              />
            ) : null}
          />
          );
        })
      )}

      <Composer
        value={commentText}
        onChangeText={(text, ids) => { setCommentText(text); setMentionedUserIds(ids); }}
        placeholder="Write a comment..."
        photos={photos}
        onSend={handleSubmit}
        sending={submitting}
        mentions
        sendLabel="Post"
        tone={tone}
        barStyle={styles.composer}
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

      <UserSummaryModal
        userId={userSummary?.userId ?? null}
        origin={userSummary?.origin}
        onClose={() => setUserSummary(null)}
      />
    </View>
  );
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

  composer:  { paddingBottom: 6 },
  // Android draws the panel's foot tighter under the bar than iOS does —
  // the Post button sat nearly on the edge — so it gets more room there.
  panelComposer: { paddingBottom: Platform.OS === 'android' ? 16 : 6 },
  // Inside the comment card: the bar's own side padding is pulled back to
  // the card's, and its ground is the card's, so it reads as part of the
  // comment it answers rather than a strip laid over it.
  replyComposer: { marginHorizontal: -12, marginTop: 4, marginBottom: -8, backgroundColor: 'transparent' },
  avatarBox: { width: 30, height: 30, flexGrow: 0, flexShrink: 0 },
});
