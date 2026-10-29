import React, { useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import SharedModal, { PANE_GRABBER_H } from '../ui/SharedModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedItemCard from '../cards/FeedItemCard';
import InlineComments, { CommentsHeading } from './InlineComments';
import { useGetPostQuery } from '../../api/apiService';
import type { Post } from '../../types/api';

/**
 * A post in a summary panel, drawn as the home feed draws it — photos, body,
 * likes, comments — so a post tapped on a shelf opens to everything it has to
 * say without leaving the page it's on.
 *
 * Opens on the post it was handed (a shelf's card has most of it) and fills in
 * from the full fetch. Everything is here — the post drawn flush on the panel
 * rather than as a card inside it, and its comments and composer under it —
 * so there's no button out to a screen with the same things on it.
 */
export default function PostSummaryModal({ post, origin, onClose }: {
  /** The post to show; null while closed. */
  post: Post | null;
  origin?: SummaryOrigin | null;
  onClose: () => void;
}) {
  // Kept through the close, so the panel fades out on its post rather than
  // emptying first.
  const last = useRef<Post | null>(null);
  if (post) last.current = post;
  const shown = post ?? last.current;

  const full = useFullPost(shown);

  return (
    <SummaryModal
      visible={!!post}
      origin={origin}
      onClose={onClose}
    >
      {full ? <PostSummaryContent post={full} visible={!!post} /> : null}
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  // The card's header brings its own room from the panel's top.
  body: { paddingTop: 0 },
  heading: { paddingTop: 10, marginBottom: 6 },
  // Starts clear of the grabber floating over the top — see PANE_GRABBER_H.
  sheetScroll: { paddingTop: PANE_GRABBER_H },
});

/** The full post, with its author, once it's fetched — the copy handed in until then. */
function useFullPost(post: Post | null): Post | null {
  const { data } = useGetPostQuery(post?.internal_id ?? '', { skip: !post });
  return data?.entry
    ? ({ ...post, ...data.entry, user: data.user ?? data.entry.user ?? post?.user } as Post)
    : post;
}

/**
 * What a post's panel or sheet holds: the post drawn flush, as the feed draws
 * it, and its comments under it — the composer pinned to the foot where the
 * host can pin it (a summary panel), at the thread's end where it can't.
 */
export function PostSummaryContent({ post, visible, pinComposer = true, fullText = false }: {
  post: Post;
  visible: boolean;
  /** The post's words in full, not clamped behind "more". */
  fullText?: boolean;
  /**
   * Pin the composer to the panel's foot. Off in a sheet: a sheet opened over
   * a panel still sits in that panel's context, and the composer would be
   * pinned to the panel behind it — out of sight.
   */
  pinComposer?: boolean;
}) {
  return (
    <View style={styles.body}>
      <FeedItemCard post={post} isLiked={(post as any).isLiked} visible={visible} bare fullText={fullText} />
      <CommentsHeading count={(post as any).comment_count ?? 0} style={styles.heading} />
      <InlineComments
        documentId={post.internal_id}
        entryType={(post as any).entry_type ?? 'post'}
        title=""
        backgroundColor="transparent"
        variant="panel"
        // Pinned to the panel's foot: under a post, the field would
        // otherwise sit wherever the thread happened to end.
        pinComposer={pinComposer}
      />
    </View>
  );
}

/**
 * The same post, in a sheet that slides up from the bottom — for opening a
 * post from inside a panel's list. Closing it drops you back on the list
 * where you were, rather than on the page under it.
 *
 * Render it inside the panel it opens over (SummaryModal's `stacked`), or on
 * iOS it won't present at all.
 */
export function PostSheet({ post, onClose }: { post: Post | null; onClose: () => void }) {
  const last = useRef<Post | null>(null);
  if (post) last.current = post;
  const shown = post ?? last.current;
  const full = useFullPost(shown);
  const insets = useSafeAreaInsets();
  return (
    // No title row — the grabber closes it — and the post running to the
    // device's bottom edge, padded clear of the home indicator.
    <SharedModal visible={!!post} onClose={onClose} heightRatio={0.9} hideHeader edgeToEdge>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.sheetScroll, { paddingBottom: insets.bottom + 24 }]}
      >
        {full ? <PostSummaryContent post={full} visible={!!post} pinComposer={false} fullText /> : null}
      </ScrollView>
    </SharedModal>
  );
}
