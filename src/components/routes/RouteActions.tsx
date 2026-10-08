import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import PostActionRail from '../social/PostActionRail';
import LikersSheet from '../social/LikersSheet';
import { usePostLike } from '../../hooks/usePostLike';
import type { SummaryOrigin } from '../ui/SummaryModal';
import type { Post } from '../../types/api';

/**
 * A route's like and comment — the same heart, faces and comment button as
 * every other card, in place of the up/down votes the detail used to carry.
 * Likes and comments are filed under `route`, which is what lets the server
 * find the route's owner and tell them.
 */
export default function RouteActions({ route, style }: {
  route: {
    internal_id: string;
    user_id?: string;
    like_count?: number;
    comment_count?: number;
    has_liked?: boolean;
    likers?: string[];
  };
  style?: any;
}) {
  const like = usePostLike({
    postId: route.internal_id,
    entryType: 'route',
    ownerId: route.user_id,
    initialLiked: route.has_liked ?? false,
    initialCount: route.like_count ?? 0,
  });
  /** Non-null while the likers panel is open — and the rect it grows from. */
  const [likersOrigin, setLikersOrigin] = useState<SummaryOrigin | null | undefined>(undefined);

  return (
    <View style={[styles.row, style]}>
      <PostActionRail
        // The rail reads a post's id and comment count; a route has both.
        post={{ internal_id: route.internal_id, comment_count: route.comment_count ?? 0 } as Post}
        entryType="route"
        like={like}
        likers={route.likers ?? []}
        onOpenLikers={(origin) => setLikersOrigin(origin)}
        vertical={false}
        bookmark={false}
      />
      <LikersSheet
        entryId={route.internal_id}
        visible={likersOrigin !== undefined}
        origin={likersOrigin}
        onClose={() => setLikersOrigin(undefined)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
