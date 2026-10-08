import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useGetPhotoSpotQuery } from '@ors/kit';
import PostActionRail from '../social/PostActionRail';
import LikersSheet from '../social/LikersSheet';
import { usePostLike } from '../../hooks/usePostLike';
import type { SummaryOrigin } from '../ui/SummaryModal';
import type { Post } from '../../types/api';

/**
 * A photo spot's like and comment, on its summary over the map — the same
 * heart, faces and comment button as every other card.
 *
 * Handed only the id (the kit's `renderSpotContext` slot), so it reads the
 * spot from the same cached detail query the summary itself is drawn from —
 * no second request. The counts and the viewer's own like come with that
 * detail (horacio's enrichEntries on /api/photospot/detail).
 */
export default function SpotActions({ spotId }: { spotId: string }) {
  const { data: spot } = useGetPhotoSpotQuery(spotId);
  const s = spot as any;
  const like = usePostLike({
    postId: spotId,
    entryType: ENTRY_TYPE,
    ownerId: spot?.user_id,
    initialLiked: s?.isLiked ?? false,
    initialCount: s?.like_count ?? 0,
  });
  /** Non-null while the likers panel is open — and the rect it grows from. */
  const [likersOrigin, setLikersOrigin] = useState<SummaryOrigin | null | undefined>(undefined);

  if (!spot) return null;

  return (
    <View style={styles.row}>
      <PostActionRail
        // The rail reads a post's id and comment count; a spot has both.
        post={{ internal_id: spotId, comment_count: s.comment_count ?? 0 } as Post}
        entryType={ENTRY_TYPE}
        like={like}
        likers={s.likers ?? []}
        onOpenLikers={(origin) => setLikersOrigin(origin)}
        vertical={false}
        bookmark={false}
      />
      <LikersSheet
        entryId={spotId}
        visible={likersOrigin !== undefined}
        origin={likersOrigin}
        onClose={() => setLikersOrigin(undefined)}
      />
    </View>
  );
}

/** What likes and comments on a spot are filed under — horacio's contentRef. */
const ENTRY_TYPE = 'photospot';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
});
