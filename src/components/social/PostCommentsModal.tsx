import React from 'react';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import { StyleSheet } from 'react-native';
import InlineComments, { CommentsHeading } from './InlineComments';
import { useCommentThread } from '../../hooks/useCommentThread';

/**
 * A post's comments in a summary panel, grown from the comment button that
 * opened it: the thread, and the composer to add to it.
 *
 * A panel over the feed rather than a sheet from the bottom, like everything
 * else a feed card opens — the likers, a member, a group. The panel lifts
 * itself clear of the keyboard, so the composer stays in view while typing.
 */
export default function PostCommentsModal({ postId, entryType, origin, onClose }: {
  postId: string;
  entryType: string;
  /** Undefined while closed; the rect it grows from while open. */
  origin: SummaryOrigin | null | undefined;
  onClose: () => void;
}) {
  // The same query the thread reads — cached, so this costs no second request.
  const { comments } = useCommentThread(entryType, postId, { skip: origin === undefined });
  return (
    <SummaryModal
      visible={origin !== undefined}
      origin={origin}
      onClose={onClose}
      // Pinned, not scrolled: when the keyboard shrinks the panel and the
      // thread scrolls to the field, the heading would be the first thing
      // to go off the top.
      header={<CommentsHeading count={comments.length} style={styles.heading} />}
    >
      <InlineComments
        documentId={postId}
        entryType={entryType}
        title=""
        backgroundColor="transparent"
        variant="panel"
      />
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  // First thing in the panel, so it brings its own clearance from the top
  // edge; the thread below starts right under it.
  heading: { paddingTop: 14, marginBottom: 6 },
});

