import React from 'react';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import InlineComments from './InlineComments';

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
  return (
    <SummaryModal visible={origin !== undefined} origin={origin} onClose={onClose}>
      <InlineComments
        documentId={postId}
        entryType={entryType}
        title="Comments"
        backgroundColor="transparent"
      />
    </SummaryModal>
  );
}

