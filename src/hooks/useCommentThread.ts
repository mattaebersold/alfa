import { useMemo } from 'react';
import { useGetCommentsQuery, useGetCommentRepliesQuery } from '../api/apiService';

export interface CommentRowItem {
  comment: any;
  isReply: boolean;
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
    const out: CommentRowItem[] = [];
    for (const cmt of comments) {
      out.push({ comment: cmt, isReply: false });
      for (const r of byParent[cmt.internal_id] || []) {
        out.push({ comment: r, isReply: true });
      }
    }
    return out;
  }, [comments, repliesData]);

  return { rows, comments, isFetching };
}
