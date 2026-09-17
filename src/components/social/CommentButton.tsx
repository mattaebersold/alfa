import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { skipToken } from '@reduxjs/toolkit/query';
import { MessageCircle } from 'lucide-react-native';
import { apiService, useGetCommentCountQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { formatActionCount } from '../../utils/text';

interface CommentButtonProps {
  /** The count from whatever list payload drew this — a snapshot. */
  count?: number;
  /**
   * The internal_id of the thing the comments are on. Supply it and the count
   * follows comments added or deleted after the payload was fetched.
   */
  documentId?: string;
  onPress?: () => void;
  /** Ink for the icon and count. Defaults to the muted grey. */
  color?: string;
}

export default function CommentButton({ count = 0, documentId, onPress, color }: CommentButtonProps) {
  const colors = useColors();
  // Callers placing this over a photo pass white; everywhere else keeps the
  // muted grey it has always used.
  const ink = color ?? colors.grey;

  /**
   * The live count, once there is one.
   *
   * `count` comes from the list that drew the card, so it's frozen at fetch
   * time — delete a comment and the bubble went on claiming the old number
   * until the whole list was refetched. Refetching the list is the wrong fix:
   * that's the entire feed again to correct one digit.
   *
   * Instead the comment mutations fetch a fresh count for the one document
   * they touched (see createComment/deleteComment in apiService), and this
   * reads it from the cache. Reading is `useQueryState`, which never fetches,
   * so the thousand cards nobody has commented on cost nothing. Once a value
   * exists the query hook subscribes as well, purely to keep that value alive
   * for as long as the card is on screen.
   *
   * It works whichever surface the comment was changed from — the card's own
   * sheet, the post's detail screen, a summary modal — because the signal is
   * the cache, not this button having been the one that was pressed.
   */
  const arg = documentId ? { id: documentId } : skipToken;
  const { data: liveCount } = apiService.endpoints.getCommentCount.useQueryState(arg);
  useGetCommentCountQuery(arg, { skip: liveCount === undefined });
  const shown = liveCount ?? count;

  return (
    <TouchableOpacity onPress={onPress} style={styles.container} activeOpacity={0.7}>
      <MessageCircle size={18} color={ink} />
      {shown > 0 && <Text style={[styles.count, { color: ink }]}>{formatActionCount(shown)}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 4 },
  count:     { fontSize: 13, fontWeight: '500' },
});
