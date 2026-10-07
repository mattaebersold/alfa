import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import PostActionRail from '../social/PostActionRail';
import LikersSheet from '../social/LikersSheet';
import { usePostLike } from '../../hooks/usePostLike';
import type { SummaryOrigin } from '../ui/SummaryModal';
import type { Post } from '../../types/api';

export type GroupItemKind = 'news' | 'discussion' | 'resource';

/**
 * A group discussion post's, news post's or resource's like and comment —
 * the same heart, faces and comment button as every other card, in place of
 * the thumbs these used to carry.
 *
 * The counts and the viewer's own like come with the lists (horacio's
 * enrichEntries, on each section's list and the feed's group activity), so
 * nothing here asks for them.
 */
export default function GroupItemActions({ kind, item, style }: {
  kind: GroupItemKind;
  item: {
    internal_id: string;
    user_id?: string;
    like_count?: number;
    comment_count?: number;
    isLiked?: boolean;
    likers?: string[];
  };
  style?: any;
}) {
  const like = usePostLike({
    postId: item.internal_id,
    entryType: ENTRY_TYPE[kind],
    ownerId: item.user_id,
    initialLiked: item.isLiked ?? false,
    initialCount: item.like_count ?? 0,
  });
  /** Non-null while the likers panel is open — and the rect it grows from. */
  const [likersOrigin, setLikersOrigin] = useState<SummaryOrigin | null | undefined>(undefined);

  return (
    <View style={[styles.row, style]}>
      <PostActionRail
        // The rail reads a post's id and comment count; these have both.
        post={{ internal_id: item.internal_id, comment_count: item.comment_count ?? 0 } as Post}
        entryType={ENTRY_TYPE[kind]}
        like={like}
        likers={item.likers ?? []}
        onOpenLikers={(origin) => setLikersOrigin(origin)}
        vertical={false}
        bookmark={false}
      />
      <LikersSheet
        entryId={item.internal_id}
        visible={likersOrigin !== undefined}
        origin={likersOrigin}
        onClose={() => setLikersOrigin(undefined)}
      />
    </View>
  );
}

/**
 * What likes and comments on each are filed under — the strings horacio's
 * contentRef resolves, and the ones the detail's comment thread already used.
 */
const ENTRY_TYPE: Record<GroupItemKind, string> = {
  news: 'groupnews',
  discussion: 'groupdiscussion',
  resource: 'groupresource',
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'flex-end' },
});
