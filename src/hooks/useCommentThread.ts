import { useMemo } from 'react';
import { useGetCommentsQuery, useGetCommentRepliesQuery } from '../api/apiService';

export interface CommentRowItem {
  comment: any;
  isReply: boolean;
  /** First row of a thread — the comment the replies hang off. */
  isThreadStart: boolean;
  /** Last row of a thread: the comment itself, or its final reply. */
  isThreadEnd: boolean;
  /**
   * The top-level comment this row belongs to. Replying to a reply attaches to
   * the same parent rather than nesting deeper — the server models one level
   * (`reply_to` points at a comment), and threads that indent forever are
   * unreadable on a phone anyway. The mention in the draft is what says who is
   * being answered.
   */
  threadId: string;
}

/**
 * Single source of truth for comment threads across the app.
 *
 * The backend returns top-level comments and replies from two endpoints
 * (getComments filters out anything with a reply_to; getReplies returns the
 * replies flat). This hook fetches both and flattens them into a display list
 * where each top-level comment is immediately followed by its nested replies —
 * so every screen renders identical, correctly-threaded comments.
 */
export function useCommentThread(entryType: string, documentId: string, opts?: { skip?: boolean }) {
  const skip = opts?.skip || !documentId;

  const { data: commentsData, isFetching } = useGetCommentsQuery(
    { type: entryType, id: documentId, limit: 50 },
    { skip }
  );
  const { data: repliesData } = useGetCommentRepliesQuery(
    { type: entryType, id: documentId },
    { skip }
  );

  const comments = commentsData?.entries ?? [];

  const rows = useMemo<CommentRowItem[]>(() => {
    const replies = repliesData?.entries ?? [];
    const byParent: Record<string, any[]> = {};
    for (const r of replies) {
      if (!r.reply_to) continue;
      (byParent[r.reply_to] = byParent[r.reply_to] || []).push(r);
    }
    for (const k of Object.keys(byParent)) {
      byParent[k].sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      );
    }
    // Flags rather than nesting: the list stays flat (one FlatList, no
    // scroller inside a scroller) while the rows still know where their thread
    // starts and ends, which is what lets a thread be drawn as one card.
    const out: CommentRowItem[] = [];
    for (const cmt of comments) {
      const threadReplies = byParent[cmt.internal_id] || [];
      out.push({
        comment: cmt,
        isReply: false,
        isThreadStart: true,
        isThreadEnd: threadReplies.length === 0,
        threadId: cmt.internal_id,
      });
      threadReplies.forEach((r, i) => {
        out.push({
          comment: r,
          isReply: true,
          isThreadStart: false,
          isThreadEnd: i === threadReplies.length - 1,
          threadId: cmt.internal_id,
        });
      });
    }
    return out;
  }, [comments, repliesData]);

  return { rows, comments, isFetching };
}
