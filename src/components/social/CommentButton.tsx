import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { skipToken } from '@reduxjs/toolkit/query';
import { MessageCircle, MessageCircleMore } from 'lucide-react-native';
import { apiService, useGetCommentCountQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { formatActionCount } from '../../utils/text';
import { FONT_INTER } from '../../constants/fonts';

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
  /** Stacked and bigger, a round speech bubble with dots — the action rail's (PostActionRail). */
  vertical?: boolean;
}

export default function CommentButton({ count = 0, documentId, onPress, color, vertical = false }: CommentButtonProps) {
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
    <TouchableOpacity
      onPress={onPress}
      style={vertical ? styles.vertical : styles.container}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Comments"
    >
      {vertical
        ? <MessageCircleMore size={21} color={ink} strokeWidth={1.8} />
        : <MessageCircle size={18} color={ink} />}
      {shown > 0 && (
        vertical ? (
          // To the icon's left, hanging off the rail like the like count, so
          // the rail stays one icon wide.
          <View style={styles.railCountWrap} pointerEvents="none">
            <Text style={[styles.railCount, { color: ink }]}>{formatActionCount(shown)}</Text>
          </View>
        ) : (
          <Text style={[styles.count, { color: ink }]}>{formatActionCount(shown)}</Text>
        )
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 4 },
  count:     { fontSize: 13, fontFamily: FONT_INTER.medium },
  vertical:  { alignItems: 'center', gap: 3, padding: 4 },
  railCountWrap: {
    // Well clear of the icon.
    position: 'absolute', right: '100%', top: 0, bottom: 0,
    marginRight: 10, justifyContent: 'center',
  },
  railCount: {
    fontSize: 12, fontFamily: FONT_INTER.bold,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
});
